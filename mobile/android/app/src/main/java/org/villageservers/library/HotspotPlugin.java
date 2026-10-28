package org.villageservers.library;

import android.Manifest;
import android.content.Context;
import android.net.wifi.SoftApConfiguration;
import android.net.wifi.WifiConfiguration;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

import org.json.JSONObject;

import java.io.File;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Share kept films and audio with phones nearby, with no internet.
 *
 * The phone opens its own small Wi-Fi network (Android's LocalOnlyHotspot) and
 * a tiny web server on it (HotspotServer). The page shows two QR codes: one
 * joins the network, the other opens the list of files in the browser. The
 * other phone needs no app, iPhone or Android.
 *
 *   Hotspot.start({ files: [{ uri, name, bytes }], page })
 *     -> { ssid, password, url }
 *   Hotspot.stop()
 *   Hotspot.status() -> { on, ssid?, password?, url?, served }
 *
 * Only the files handed to start() can be fetched, by their place in the list.
 */
@CapacitorPlugin(
    name = "Hotspot",
    permissions = {
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION }),
        @Permission(alias = "nearby", strings = { "android.permission.NEARBY_WIFI_DEVICES" })
    }
)
public class HotspotPlugin extends Plugin {
    private static final int PORT = 8080;

    private WifiManager.LocalOnlyHotspotReservation reservation;
    private HotspotServer server;
    private String ssid, password, url;

    private String alias() {
        return Build.VERSION.SDK_INT >= 33 ? "nearby" : "location";
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT < 26) {
            call.reject("This phone is too old to open its own Wi-Fi.", "OLD_ANDROID");
            return;
        }
        if (getPermissionState(alias()) != PermissionState.GRANTED) {
            requestPermissionForAlias(alias(), call, "permissionDone");
            return;
        }
        open(call);
    }

    @PermissionCallback
    private void permissionDone(PluginCall call) {
        if (getPermissionState(alias()) == PermissionState.GRANTED) open(call);
        else call.reject("Permission to open Wi-Fi was not given.", "PERMISSION");
    }

    private void open(final PluginCall call) {
        final List<HotspotServer.Entry> files = new ArrayList<>();
        JSArray list = call.getArray("files", new JSArray());
        try {
            for (int i = 0; i < list.length(); i++) {
                JSONObject f = list.getJSONObject(i);
                String uri = f.getString("uri");
                File file = new File(uri.startsWith("file://") ? android.net.Uri.parse(uri).getPath() : uri);
                if (!file.isFile()) continue;
                files.add(new HotspotServer.Entry(file, f.optString("name", file.getName())));
            }
        } catch (Exception e) {
            call.reject("The file list could not be read.", "BAD_FILES", e);
            return;
        }
        if (files.isEmpty()) {
            call.reject("None of those files are on this phone.", "NO_FILES");
            return;
        }
        final String page = call.getString("page", "");
        stopAll();

        WifiManager wifi = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        try {
            wifi.startLocalOnlyHotspot(new WifiManager.LocalOnlyHotspotCallback() {
                @Override
                public void onStarted(WifiManager.LocalOnlyHotspotReservation r) {
                    reservation = r;
                    readCredentials(r);
                    try {
                        server = new HotspotServer(PORT, files, page);
                        server.start();
                    } catch (Exception e) {
                        stopAll();
                        call.reject("The sharing server did not start.", "SERVER", e);
                        return;
                    }
                    // The network's address is chosen by Android; wait a moment for it.
                    waitForAddress(call, 0);
                }

                @Override
                public void onFailed(int reason) {
                    reservation = null;
                    String code = reason == ERROR_INCOMPATIBLE_MODE ? "INCOMPATIBLE_MODE"
                        : reason == ERROR_TETHERING_DISALLOWED ? "TETHERING_DISALLOWED"
                        : reason == ERROR_NO_CHANNEL ? "NO_CHANNEL" : "GENERIC";
                    call.reject("The phone could not open its own Wi-Fi (" + code + ").", code);
                }
            }, new Handler(Looper.getMainLooper()));
        } catch (SecurityException e) {
            call.reject("Permission to open Wi-Fi was not given.", "PERMISSION", e);
        } catch (IllegalStateException e) {
            // Already open for this app: Android allows one at a time.
            call.reject("The phone's Wi-Fi is busy. Turn the hotspot off and try again.", "BUSY", e);
        }
    }

    @SuppressWarnings("deprecation")
    private void readCredentials(WifiManager.LocalOnlyHotspotReservation r) {
        ssid = password = null;
        if (Build.VERSION.SDK_INT >= 30) {
            SoftApConfiguration c = r.getSoftApConfiguration();
            if (Build.VERSION.SDK_INT >= 33 && c.getWifiSsid() != null) {
                ssid = c.getWifiSsid().toString().replaceAll("^\"|\"$", "");
            } else {
                ssid = c.getSsid();
            }
            password = c.getPassphrase();
        } else {
            WifiConfiguration c = r.getWifiConfiguration();
            if (c != null) { ssid = c.SSID; password = c.preSharedKey; }
        }
    }

    private void waitForAddress(final PluginCall call, final int tries) {
        String ip = hotspotAddress();
        if (ip == null && tries < 20) {
            new Handler(Looper.getMainLooper()).postDelayed(() -> waitForAddress(call, tries + 1), 250);
            return;
        }
        if (ip == null) ip = "192.168.43.1";   // the usual address, if Android does not say
        url = "http://" + ip + ":" + PORT + "/";
        JSObject ret = new JSObject();
        ret.put("ssid", ssid);
        ret.put("password", password);
        ret.put("url", url);
        call.resolve(ret);
    }

    /** The phone's own address on the network it just opened. */
    private static String hotspotAddress() {
        try {
            String fallback = null;
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                String name = ni.getName();
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (!(a instanceof Inet4Address) || !a.isSiteLocalAddress()) continue;
                    String ip = a.getHostAddress();
                    if (name.startsWith("ap") || name.startsWith("swlan") || name.startsWith("softap")) return ip;
                    if (name.startsWith("wlan") && ip.endsWith(".1")) fallback = ip;
                }
            }
            return fallback;
        } catch (Exception e) {
            return null;
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopAll();
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("on", reservation != null);
        if (reservation != null) {
            ret.put("ssid", ssid);
            ret.put("password", password);
            ret.put("url", url);
        }
        ret.put("served", server != null ? server.served() : 0);
        call.resolve(ret);
    }

    private void stopAll() {
        if (server != null) { server.stop(); server = null; }
        if (reservation != null) {
            try { reservation.close(); } catch (Exception ignored) {}
            reservation = null;
        }
        ssid = password = url = null;
    }

    @Override
    protected void handleOnDestroy() {
        stopAll();
        super.handleOnDestroy();
    }
}
