package org.villageservers.library;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The smallest web server that does the job, for HotspotPlugin.
 *
 *   GET /             the page the app built (the list of files, in the
 *                     reader's language), served as it is
 *   GET /f/<n>/<name> file n of the list, with Range so a browser can play
 *                     it or carry on a broken download
 *
 * Nothing else is answered: no paths, no directory listings, no uploads.
 */
class HotspotServer {
    static class Entry {
        final File file;
        final String name;
        Entry(File file, String name) { this.file = file; this.name = name; }
    }

    private static final Pattern FILE = Pattern.compile("^/f/(\\d+)(/.*)?$");
    private static final Pattern RANGE = Pattern.compile("bytes=(\\d*)-(\\d*)");

    private final int port;
    private final List<Entry> files;
    private final byte[] page;
    private final AtomicInteger served = new AtomicInteger();
    private ServerSocket socket;
    private ExecutorService pool;

    HotspotServer(int port, List<Entry> files, String page) {
        this.port = port;
        this.files = files;
        this.page = page.getBytes(StandardCharsets.UTF_8);
    }

    int served() { return served.get(); }

    /** The address of file n, as the page links to it. */
    static String path(int n, String name) {
        try {
            return "/f/" + n + "/" + URLEncoder.encode(name, "UTF-8").replace("+", "%20");
        } catch (Exception e) {
            return "/f/" + n;
        }
    }

    void start() throws IOException {
        socket = new ServerSocket(port);
        socket.setReuseAddress(true);
        pool = Executors.newFixedThreadPool(8);
        Thread accept = new Thread(() -> {
            while (socket != null && !socket.isClosed()) {
                try {
                    final Socket s = socket.accept();
                    pool.execute(() -> handle(s));
                } catch (IOException e) {
                    break;
                }
            }
        }, "hotspot-accept");
        accept.setDaemon(true);
        accept.start();
    }

    void stop() {
        try { if (socket != null) socket.close(); } catch (IOException ignored) {}
        socket = null;
        if (pool != null) pool.shutdownNow();
        pool = null;
    }

    private void handle(Socket s) {
        try (Socket c = s) {
            c.setSoTimeout(30000);
            InputStream in = new BufferedInputStream(c.getInputStream());
            String request = line(in);
            if (request == null) return;
            String range = null;
            for (String h; (h = line(in)) != null && !h.isEmpty(); ) {
                if (h.toLowerCase(Locale.ROOT).startsWith("range:")) range = h.substring(6).trim();
            }
            String[] parts = request.split(" ");
            if (parts.length < 2) return;
            String method = parts[0];
            boolean head = method.equals("HEAD");
            if (!head && !method.equals("GET")) { status(c.getOutputStream(), 405, "Method Not Allowed"); return; }
            String target = parts[1];
            int q = target.indexOf('?');
            if (q >= 0) target = target.substring(0, q);

            OutputStream out = c.getOutputStream();
            if (target.equals("/") || target.equals("/index.html")) {
                out.write(("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n" +
                    "Content-Length: " + page.length + "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n")
                    .getBytes(StandardCharsets.US_ASCII));
                if (!head) out.write(page);
                out.flush();
                return;
            }
            Matcher m = FILE.matcher(target);
            if (!m.matches()) { status(out, 404, "Not Found"); return; }
            int n;
            try { n = Integer.parseInt(m.group(1)); } catch (NumberFormatException e) { status(out, 404, "Not Found"); return; }
            if (n < 0 || n >= files.size()) { status(out, 404, "Not Found"); return; }
            send(out, files.get(n), range, head);
        } catch (IOException ignored) {
            // The other phone walked away mid-file; nothing to do.
        }
    }

    private void send(OutputStream out, Entry e, String range, boolean head) throws IOException {
        long size = e.file.length(), from = 0, to = size - 1;
        boolean partial = false;
        if (range != null) {
            Matcher r = RANGE.matcher(range);
            if (r.matches()) {
                String a = r.group(1), b = r.group(2);
                if (a.isEmpty() && !b.isEmpty()) { from = Math.max(0, size - Long.parseLong(b)); }
                else if (!a.isEmpty()) {
                    from = Long.parseLong(a);
                    if (!b.isEmpty()) to = Math.min(Long.parseLong(b), size - 1);
                }
                if (from > to || from >= size) {
                    out.write(("HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */" + size +
                        "\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
                    return;
                }
                partial = true;
            }
        }
        long length = to - from + 1;
        String encoded;
        try { encoded = URLEncoder.encode(e.name, "UTF-8").replace("+", "%20"); } catch (Exception x) { encoded = "file"; }
        String ascii = e.name.replaceAll("[^\\x20-\\x7E]", "_").replace("\"", "'");
        StringBuilder h = new StringBuilder();
        h.append(partial ? "HTTP/1.1 206 Partial Content\r\n" : "HTTP/1.1 200 OK\r\n");
        h.append("Content-Type: ").append(mime(e.name)).append("\r\n");
        h.append("Content-Length: ").append(length).append("\r\n");
        h.append("Accept-Ranges: bytes\r\n");
        if (partial) h.append("Content-Range: bytes ").append(from).append('-').append(to).append('/').append(size).append("\r\n");
        h.append("Content-Disposition: attachment; filename=\"").append(ascii)
            .append("\"; filename*=UTF-8''").append(encoded).append("\r\n");
        h.append("Connection: close\r\n\r\n");
        out.write(h.toString().getBytes(StandardCharsets.US_ASCII));
        if (head) { out.flush(); return; }
        try (RandomAccessFile f = new RandomAccessFile(e.file, "r")) {
            f.seek(from);
            byte[] buf = new byte[256 * 1024];
            long left = length;
            while (left > 0) {
                int read = f.read(buf, 0, (int) Math.min(buf.length, left));
                if (read < 0) break;
                out.write(buf, 0, read);
                left -= read;
            }
        }
        out.flush();
        if (!partial || to == size - 1) served.incrementAndGet();
    }

    private static void status(OutputStream out, int code, String text) throws IOException {
        out.write(("HTTP/1.1 " + code + " " + text + "\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            .getBytes(StandardCharsets.US_ASCII));
        out.flush();
    }

    private static String mime(String name) {
        String n = name.toLowerCase(Locale.ROOT);
        if (n.endsWith(".mp4") || n.endsWith(".m4v")) return "video/mp4";
        if (n.endsWith(".mp3")) return "audio/mpeg";
        if (n.endsWith(".m4a")) return "audio/mp4";
        if (n.endsWith(".pdf")) return "application/pdf";
        if (n.endsWith(".epub")) return "application/epub+zip";
        if (n.endsWith(".zip")) return "application/zip";
        return "application/octet-stream";
    }

    /** One header line, without its CRLF; null at the end of the stream. */
    private static String line(InputStream in) throws IOException {
        StringBuilder sb = new StringBuilder();
        int b;
        while ((b = in.read()) != -1) {
            if (b == '\n') break;
            if (b != '\r') sb.append((char) b);
            if (sb.length() > 8192) throw new IOException("header too long");
        }
        return b == -1 && sb.length() == 0 ? null : sb.toString();
    }
}
