"""
Visitor-facing copy for hardcoded (non-LLM) replies.

Language is locked by the widget URL (`?lang=en|sv|fi`), sent as `locale` on
/chat and /greeting. Session state keeps that locale for the whole conversation
— never switch mid-chat from visitor text.
"""
from __future__ import annotations

SUPPORTED = ("en", "sv", "fi")
DEFAULT_LOCALE = "en"

# Pack defaults when DB has no locale-scoped greeting.
DEFAULT_GREETINGS = {
    "en": (
        "Hi! Tell me a bit about what you're looking for — a theme, a situation, "
        "a team size, whatever comes to mind — and I'll help point you to the right fit."
    ),
    "sv": (
        "Hej! Berätta lite om vad du letar efter — ett tema, en situation, "
        "en gruppstorlek, vad som helst — så hjälper jag dig att hitta rätt."
    ),
    "fi": (
        "Hei! Kerro vähän, mitä etsit — teema, tilanne, ryhmäkoko, mikä vain "
        "tulee mieleen — niin autan löytämään sopivan."
    ),
}

LANGUAGE_NAME = {
    "en": "English",
    "sv": "Swedish",
    "fi": "Finnish",
}

# key -> {locale: template}. Templates use str.format kwargs where needed.
_STRINGS: dict[str, dict[str, str]] = {
    "opener_need_situation": {
        "en": "Tell me a bit about the situation you'd like help with.",
        "sv": "Berätta lite om situationen ni vill ha hjälp med.",
        "fi": "Kerro vähän tilanteesta, johon kaipaat apua.",
    },
    "opener_after_price": {
        "en": (
            "I can't talk about price until I know the fit. "
            "What situation are you hoping coaching can help with?"
        ),
        "sv": (
            "Jag kan inte prata pris innan jag förstår behovet. "
            "Vilken situation hoppas ni att coachning kan hjälpa med?"
        ),
        "fi": (
            "En voi puhua hinnasta ennen kuin tiedän sopivuuden. "
            "Millaisessa tilanteessa toivoisit valmennuksen auttavan?"
        ),
    },
    "opener_after_boundary": {
        "en": "If you want help finding a coach, tell me a bit about the situation.",
        "sv": "Om du vill ha hjälp att hitta en coach, berätta lite om situationen.",
        "fi": "Jos haluat apua valmentajan löytämiseen, kerro vähän tilanteesta.",
    },
    "ask_timing": {
        "en": "That gives me a real picture. When would you want this to start?",
        "sv": "Det ger mig en bra bild. När skulle ni vilja börja?",
        "fi": "Siitä saa hyvän kuvan. Milloin haluaisitte aloittaa?",
    },
    "ask_timing_short": {
        "en": "When would you want this to start?",
        "sv": "När skulle ni vilja börja?",
        "fi": "Milloin haluaisitte aloittaa?",
    },
    "ask_one_more_detail": {
        "en": (
            "Before I suggest anyone, is there one more detail about how this "
            "is showing up for the team?"
        ),
        "sv": (
            "Innan jag föreslår någon: finns det en detalj till om hur detta "
            "syns i teamet?"
        ),
        "fi": (
            "Ennen kuin ehdotan ketään: onko vielä yksi yksityiskohta siitä, "
            "miten tämä näkyy tiimissä?"
        ),
    },
    "opener_need_clarify": {
        "en": (
            "I mean the situation you want help with. For example: a team that "
            "has lost motivation, or managers who are new in the role. A sentence "
            "or two is enough."
        ),
        "sv": (
            "Jag menar situationen ni vill ha hjälp med. Till exempel ett team "
            "som tappat motivationen, eller chefer som är nya i rollen. En eller "
            "två meningar räcker."
        ),
        "fi": (
            "Tarkoitan tilannetta, johon haluat apua. Esimerkiksi tiimi, jonka "
            "motivaatio on kadonnut, tai esimiehet, jotka ovat uusia roolissaan. "
            "Pari lausetta riittää."
        ),
    },
    "opener_need_skip_offer": {
        "en": "If that question isn't useful, say skip and we'll move on without it.",
        "sv": "Om frågan inte hjälper, skriv hoppa så går vi vidare utan den.",
        "fi": "Jos kysymys ei tunnu hyödylliseltä, kirjoita ohita, niin jatketaan ilman sitä.",
    },
    "ask_timing_clarify": {
        "en": (
            "I mean when you would like this to start. For example: next month, "
            "this quarter, or no fixed date yet."
        ),
        "sv": (
            "Jag menar när ni vill att det ska börja. Till exempel nästa månad, "
            "det här kvartalet, eller inget fast datum ännu."
        ),
        "fi": (
            "Tarkoitan sitä, milloin haluaisit tämän alkavan. Esimerkiksi ensi "
            "kuussa, tällä neljänneksellä, tai ilman tarkkaa päivää."
        ),
    },
    "ask_timing_skip_offer": {
        "en": "If you don't have a start date, say skip and I'll look for a fit without one.",
        "sv": "Om ni inte har ett startdatum, skriv hoppa så letar jag efter en matchning utan det.",
        "fi": "Jos aloitusajankohtaa ei ole, kirjoita ohita, niin etsin sopivuuden ilman sitä.",
    },
    "skip_situation_then_timing": {
        "en": "No problem, we can skip that. When would you want this to start?",
        "sv": "Inga problem, vi kan hoppa över det. När skulle ni vilja börja?",
        "fi": "Ei haittaa, voidaan ohittaa tuo. Milloin haluaisitte aloittaa?",
    },
    "refuse_medical_legal": {
        "en": "I can't give medical or legal advice.",
        "sv": "Jag kan inte ge medicinsk eller juridisk rådgivning.",
        "fi": "En voi antaa lääketieteellistä tai juridista neuvontaa.",
    },
    "refuse_off_topic": {
        "en": "That's outside what I can help with here.",
        "sv": "Det ligger utanför det jag kan hjälpa till med här.",
        "fi": "Se ei kuulu siihen, missä voin auttaa tässä.",
    },
    "coach_selected": {
        "en": (
            "Great choice, {coach_name}'s {program_name} it is.{known} "
            "Could I get your name and email so the team can follow up with next steps?"
        ),
        "sv": (
            "Bra val — {program_name} med {coach_name}.{known} "
            "Kan jag få ditt namn och din e-post så att teamet kan ta nästa steg?"
        ),
        "fi": (
            "Hyvä valinta — {program_name} valmentajalta {coach_name}.{known} "
            "Saisinko nimesi ja sähköpostiosoitteesi, jotta tiimi voi hoitaa seuraavat askeleet?"
        ),
    },
    "known_fit_prefix": {
        "en": " I already have {facts}.",
        "sv": " Jag har redan: {facts}.",
        "fi": " Minulla on jo: {facts}.",
    },
    "fact_group_size": {
        "en": "about {n} people",
        "sv": "ungefär {n} personer",
        "fi": "noin {n} henkilöä",
    },
    "fact_timing": {
        "en": "starting {timing}",
        "sv": "start {timing}",
        "fi": "aloitus {timing}",
    },
    "still_need_contact": {
        "en": (
            "I still need your name and email so the team can follow up on "
            "{coach_name}'s {program_name}.{known}"
        ),
        "sv": (
            "Jag behöver fortfarande ditt namn och din e-post så att teamet kan "
            "följa upp {coach_name}s {program_name}.{known}"
        ),
        "fi": (
            "Tarvitsen vielä nimesi ja sähköpostiosoitteesi, jotta tiimi voi "
            "jatkaa {coach_name}n ohjelman {program_name} kanssa.{known}"
        ),
    },
    "thanks_use_email_only": {
        "en": "Thank you. I'll use {contact} for the follow-up on {program}.{known}",
        "sv": "Tack. Jag använder {contact} för uppföljning om {program}.{known}",
        "fi": "Kiitos. Käytän osoitetta {contact} seurantaan ohjelmasta {program}.{known}",
    },
    "thanks_use_email_ask_optional": {
        "en": (
            "Thank you. I'll use {contact} for the follow-up on {program}.{known} "
            "If you have it, {ask}? Skipping that is fine."
        ),
        "sv": (
            "Tack. Jag använder {contact} för uppföljning om {program}.{known} "
            "Om du har det: {ask}? Det går bra att hoppa över."
        ),
        "fi": (
            "Kiitos. Käytän osoitetta {contact} seurantaan ohjelmasta {program}.{known} "
            "Jos tiedät: {ask}? Voit myös ohittaa."
        ),
    },
    "thanks_send_close": {
        "en": (
            "Thank you. I'll send {coach_name}'s {program} to the team with {facts}. "
            "They'll follow up at {contact}."
        ),
        "sv": (
            "Tack. Jag skickar {coach_name}s {program} till teamet med {facts}. "
            "De hör av sig till {contact}."
        ),
        "fi": (
            "Kiitos. Lähetän {coach_name}n ohjelman {program} tiimille tiedoilla: {facts}. "
            "He ottavat yhteyttä osoitteeseen {contact}."
        ),
    },
    "thanks_already_have_close": {
        "en": (
            "Thanks — I already have {contact}. "
            "I'll send {coach_name}'s {program} to the team with {facts}."
        ),
        "sv": (
            "Tack — jag har redan {contact}. "
            "Jag skickar {coach_name}s {program} till teamet med {facts}."
        ),
        "fi": (
            "Kiitos — minulla on jo {contact}. "
            "Lähetän {coach_name}n ohjelman {program} tiimille tiedoilla: {facts}."
        ),
    },
    "thanks_already_have_stay": {
        "en": (
            "Thanks — I already have {contact} for follow-up on "
            "{coach_name}'s {program}.{known}"
        ),
        "sv": (
            "Tack — jag har redan {contact} för uppföljning om "
            "{coach_name}s {program}.{known}"
        ),
        "fi": (
            "Kiitos — minulla on jo {contact} seurantaan ohjelmasta "
            "{coach_name} / {program}.{known}"
        ),
    },
    "pass_along": {
        "en": (
            "I'll pass that along with {coach_name}'s {program}: {note}. "
            "The team will follow up with the quote and next steps."
        ),
        "sv": (
            "Jag skickar vidare det tillsammans med {coach_name}s {program}: {note}. "
            "Teamet återkommer med offert och nästa steg."
        ),
        "fi": (
            "Välitän tämän tiimille ohjelman {program} ({coach_name}) kanssa: {note}. "
            "He palaavat tarjouksen ja seuraavien askelten kanssa."
        ),
    },
    "skip_optional_close": {
        "en": (
            "No problem.{extra} I'll send {coach_name}'s {program} to the team "
            "and they'll be in touch."
        ),
        "sv": (
            "Inga problem.{extra} Jag skickar {coach_name}s {program} till teamet "
            "så hör de av sig."
        ),
        "fi": (
            "Ei haittaa.{extra} Lähetän {coach_name}n ohjelman {program} tiimille, "
            "ja he ottavat yhteyttä."
        ),
    },
    "already_have_facts": {
        "en": " I already have {facts}.",
        "sv": " Jag har redan {facts}.",
        "fi": " Minulla on jo {facts}.",
    },
    "post_handoff_goodbye": {
        "en": "Glad I could help — the team will take it from here. Take care!",
        "sv": "Kul att jag kunde hjälpa — teamet tar det härifrån. Ha det bra!",
        "fi": "Kiva kun pystyin auttamaan — tiimi hoitaa tästä eteenpäin. Hei hei!",
    },
    "post_handoff_add": {
        "en": (
            "Thanks, I'll add that for the team on {coach_name}'s {program}: {note}. "
            "They're already set to follow up{contact_bit}."
        ),
        "sv": (
            "Tack, jag lägger till det för teamet om {coach_name}s {program}: {note}. "
            "De är redan redo att följa upp{contact_bit}."
        ),
        "fi": (
            "Kiitos, lisään tämän tiimille ohjelmasta {coach_name} / {program}: {note}. "
            "He jatkavat jo seurantaa{contact_bit}."
        ),
    },
    "contact_at": {
        "en": " at {contact}",
        "sv": " via {contact}",
        "fi": " osoitteeseen {contact}",
    },
    "optional_group_size": {
        "en": "roughly how many people",
        "sv": "ungefär hur många personer",
        "fi": "suunnilleen kuinka monta henkilöä",
    },
    "optional_format": {
        "en": "whether in-person, remote, or hybrid works best",
        "sv": "om ni föredrar på plats, remote eller hybrid",
        "fi": "sopiiko lähi-, etä- vai hybridivalmennus paremmin",
    },
    "optional_schedule": {
        "en": "any day or time to work around",
        "sv": "några dagar eller tider att undvika",
        "fi": "päiviä tai aikoja, joita kannattaa välttää",
    },
    "match_lead_theme": {
        "en": "Given what you shared about {theme}, here are fits worth a closer look.",
        "sv": "Utifrån det du delade om {theme} är dessa värda en närmare titt.",
        "fi": "Sen perusteella, mitä kerroit aiheesta {theme}, nämä sopivat tarkemmin katsottaviksi.",
    },
    "match_lead_generic": {
        "en": "Given what you shared, here are fits worth a closer look.",
        "sv": "Utifrån det du delade är dessa värda en närmare titt.",
        "fi": "Sen perusteella, mitä kerroit, nämä sopivat tarkemmin katsottaviksi.",
    },
    "match_quote_cta": {
        "en": "Would you like me to put this together as a quote request for you?",
        "sv": "Vill du att jag sammanställer detta som en offertförfrågan?",
        "fi": "Haluatko, että kokoan tämän tarjouspyynnöksi?",
    },
    "match_score_suffix": {
        "en": " ({score}% match)",
        "sv": " ({score}% match)",
        "fi": " ({score} % osuma)",
    },
    "no_match_handoff": {
        "en": (
            "I don't have an automatic fit for that yet, so I'll pass this on to the "
            "team to find the right person personally — they work with a wider network "
            "than what I search first. Is there anything else about the situation I "
            "should note for them?"
        ),
        "sv": (
            "Jag har ingen automatisk match ännu, så jag skickar detta till teamet "
            "som letar vidare personligen — de har ett bredare nätverk än det jag "
            "söker i först. Finns det något mer om situationen jag bör notera?"
        ),
        "fi": (
            "Minulla ei ole vielä automaattista osumaa, joten välitän tämän tiimille, "
            "joka etsii sopivan henkilön — heillä on laajempi verkosto kuin mitä "
            "etsin ensin. Onko tilanteesta vielä jotain, minkä voisin merkitä heille?"
        ),
    },
    "what_you_described": {
        "en": "what you described",
        "sv": "det du beskrev",
        "fi": "kuvaamasi tilanne",
    },
}


def normalize_locale(locale: str | None) -> str:
    if not locale:
        return DEFAULT_LOCALE
    code = locale.strip().lower().replace("_", "-")
    if code in SUPPORTED:
        return code
    primary = code.split("-", 1)[0]
    return primary if primary in SUPPORTED else DEFAULT_LOCALE


def resolve_locale(
    requested: str | None,
    session_locale: str | None = None,
    message: str | None = None,  # kept for call-site compat; never used to switch
) -> str:
    """
    Lock language for the session from the widget URL (`?lang=` → `locale`).

    Once a session locale is set, it never changes mid-chat — including when
    the visitor writes in another language. No text-based language inference.
    """
    del message  # explicit: do not infer from visitor text
    if session_locale:
        return normalize_locale(session_locale)
    return normalize_locale(requested)


def default_greeting(locale: str | None) -> str:
    loc = normalize_locale(locale)
    return DEFAULT_GREETINGS.get(loc) or DEFAULT_GREETINGS[DEFAULT_LOCALE]


def t(locale: str | None, key: str, **kwargs) -> str:
    loc = normalize_locale(locale)
    table = _STRINGS.get(key) or {}
    template = table.get(loc) or table.get(DEFAULT_LOCALE) or key
    if kwargs:
        try:
            return template.format(**kwargs)
        except (KeyError, IndexError):
            return template
    return template


def language_label(locale: str | None) -> str:
    return LANGUAGE_NAME.get(normalize_locale(locale), LANGUAGE_NAME[DEFAULT_LOCALE])


# Back-compat aliases used by tests that imported English constants.
OPENER_NEED_SITUATION = _STRINGS["opener_need_situation"]["en"]
OPENER_AFTER_PRICE = _STRINGS["opener_after_price"]["en"]
OPENER_AFTER_BOUNDARY = _STRINGS["opener_after_boundary"]["en"]
