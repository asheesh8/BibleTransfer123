"""Chapter slugs for the JESUS film and the Gospel of John, as used in the DBS
CDN filenames. Copied from GawahiiTV's build_resources.py so every language
build uses the same chapter list and titles."""

JESUS_SLUGS = ["the_beginning","birth_of_jesus","childhood_of_jesus","baptism_of_jesus_by_john",
"the_devil_tempts_jesus","jesus_proclaims_fulfillment_of_the_scriptures",
"parable_of_the_pharisee_and_tax_collector","miraculous_catch_of_fish",
"jairuss_daughter_brought_back_to_life","disciples_chosen","beatitudes","sermon_on_the_mount",
"blessed_are_those_who_hear_and_obey","sinful_woman_forgiven","women_disciples",
"john_the_baptist_in_prison","parable_of_the_sower_and_the_seed","parable_of_the_lamp",
"jesus_calms_the_storm","healing_of_the_demoniac","jesus_feeds_5000",
"peter_declares_jesus_to_be_the_christ","the_transfiguration","jesus_heals_boy_from_evil_spirit",
"the_lords_prayer","teaching_about_prayer_and_faith","woe_to_those_who_cause_others_to_sin",
"the_kingdom_of_god_as_a_mustard_seed","jesus_spends_time_with_sinners","healing_on_the_sabbath",
"parable_of_the_good_samaritan","healing_of_bartimaeus","jesus_and_zaccheus",
"jesus_predicts_his_death_and_resurrection","jesuss_triumphal_entry","jesus_weeps_over_jerusalem",
"jesus_drives_out_money_changers","widows_offering","annas_questions_jesuss_authority",
"parable_of_the_vineyard_and_tenants","paying_taxes_to_caesar","the_last_supper",
"upper_room_teaching","jesus_is_betrayed_and_arrested","peter_disowns_jesus",
"jesus_is_mocked_and_questioned","jesus_is_brought_to_pilate","jesus_is_brought_to_herod",
"jesus_is_sentenced","jesus_carries_his_cross","jesus_is_crucified",
"soldiers_gamble_for_jesuss_clothes","sign_on_the_cross","crucified_convicts","death_of_jesus",
"burial_of_jesus","angels_at_the_tomb","the_tomb_is_empty","resurrected_jesus_appears",
"great_commission_and_ascension","invitation_to_know_jesus_personally"]

JOHN_SLUGS = ["gods_word_becomes_flesh","testimony_of_john_the_baptist","jesus_gathers_disciples",
"wedding_in_cana","cleaning_the_temple","talk_with_nicodemus","the_baptists_confirmation",
"samaritan_woman","samaritan_village","officials_son_healed","a_paralytic_healed",
"claim_to_be_the_son","witness_to_the_son","feeding_5000","sea_walking","bread_of_life",
"falling_away","confronting_hypocritical_leaders","disagreement_who_is_jesus","adulterous_woman",
"who_are_you","great_confrontation","blind_man_healed","pharisees_interrogate_the_blind_man",
"the_good_shepherd","are_you_messiah","lazarus_dies","mary_and_martha_mourn","lazarus_rises",
"triumphal_entry_and_results","divided_opinions","last_supper","betrayal_and_denial_foretold",
"jesus_comforts_his_disciples","jesus_promises_the_holy_spirit","the_vine_and_the_branches",
"the_worlds_hatred","the_work_of_the_holy_spirit","grief_will_turn_to_joy",
"jesus_prays_to_be_glorified","the_arrest_of_jesus_and_peters_denial",
"my_kingdom_is_not_of_this_world","jesus_sentenced_to_be_crucified","the_crucifixion_of_jesus",
"jesus_is_alive","doubting_thomas","miraculous_catch","do_you_love_me",
"how_to_know_jesus_personally"]


def titlecase(slug):
    small = {"of","the","to","and","in","a","by","for","be","is","are","his","who","not","on","as","with"}
    words = slug.replace("_"," ").split()
    out = []
    for i, w in enumerate(words):
        if w in ("5000",): out.append(w)
        elif i and w in small: out.append(w)
        else: out.append(w.capitalize())
    return " ".join(out)
