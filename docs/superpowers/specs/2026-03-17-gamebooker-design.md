# Gamebooker — Design Specification

**Datum:** 2026-03-17
**Stav:** Schváleno

---

## Přehled

Gamebooker je webová aplikace umožňující vytváření, sdílení a hraní interaktivních gamebooků. Primární jazyk rozhraní i obsahu je čeština. Aplikace slouží dvěma typům uživatelů: **tvůrcům** (děti i rodiče) a **čtenářům** (anonymní uživatelé). Tvůrci se přihlašují a vytvářejí gamebooky s pomocí AI asistenta. Čtenáři hrají publikované gamebooky bez nutnosti registrace.

---

## Tech Stack

| Vrstva | Technologie |
|---|---|
| Frontend + Backend | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS + shadcn/ui |
| Node graf editor | React Flow |
| Validace | Zod |
| Databáze + Auth | Supabase (PostgreSQL, Row Level Security) |
| Nasazení | Vercel (free tier) |
| AI vrstva | Provider-agnostic abstraction (Anthropic, OpenAI, …) |

**Budoucí mobilní aplikace:** React Native konzumuje stejné Next.js API routes — žádný backend rewrite.

---

## Datový model

### `users`
Spravováno Supabase Auth. Tvůrci pouze (čtenáři nemají účet).

### `gamebooks`
| Pole | Typ | Popis |
|---|---|---|
| id | uuid | PK |
| creator_id | uuid | FK → users |
| creator_display_name | text | Jméno tvůrce (denormalizováno pro zobrazení v knihovně) |
| title | text | Název gamebooku |
| description | text | Krátký popis |
| cover_image_url | text | URL obálky |
| genre | text | Žánr (pro filtrování v knihovně) |
| status | enum | `draft` \| `published` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `nodes`
| Pole | Typ | Popis |
|---|---|---|
| id | uuid | PK |
| gamebook_id | uuid | FK → gamebooks |
| type | enum | `story` \| `combat` \| `item_discovery` \| `ending` |
| title | text | Krátký název uzlu (pro editor) |
| content | text | Plný text příběhu pro čtenáře |
| is_start | boolean | Označuje vstupní uzel gamebooku (právě jeden per gamebook) |
| x | float | Pozice na canvasu |
| y | float | Pozice na canvasu |

**Vstupní uzel:** Každý gamebook musí mít právě jeden uzel s `is_start = true`. Validace před publikováním blokuje publish pokud chybí nebo jich je více. Čtenářská session se inicializuje na tomto uzlu.

### `choices`
| Pole | Typ | Popis |
|---|---|---|
| id | uuid | PK |
| from_node_id | uuid | FK → nodes |
| to_node_id | uuid | FK → nodes |
| text | text | Text volby zobrazený čtenáři |
| condition_item_id | uuid | Volitelně: vyžaduje předmět v inventáři |

**Podmíněné volby:** Pokud `condition_item_id` je nastaveno a hráč daný předmět nemá, volba se v čtenářském rozhraní **skryje** (není viditelná). Tím se zabrání frustraci ze zablokovaných voleb.

### `items`
| Pole | Typ | Popis |
|---|---|---|
| id | uuid | PK |
| gamebook_id | uuid | FK → gamebooks |
| name | text | Název předmětu |
| description | text | Popis předmětu |
| stat_bonus_attribute | enum | `sila` \| `inteligence` \| `obratnost` \| `stesti` \| null |
| stat_bonus_value | int | Hodnota bonusu (např. +1) |

### `node_items`
Vazební tabulka: jaké předměty čtenář najde na daném uzlu. Primární klíč: `(node_id, item_id)`.

**Logika sbírání předmětů:** Předměty se udělují pouze při **první návštěvě** uzlu. Čtenářská logika před udělením předmětu zkontroluje `visitedNodes` v localStorage — pokud uzel již navštíven byl, předměty se neudělují znovu.

| Pole | Typ |
|---|---|
| node_id | uuid |
| item_id | uuid |

### `combat_configs`
| Pole | Typ | Popis |
|---|---|---|
| id | uuid | PK |
| node_id | uuid | FK → nodes (type=combat) |
| enemy_name | text | Jméno nepřítele |
| enemy_sila | int | Síla nepřítele |
| enemy_inteligence | int | |
| enemy_obratnost | int | |
| enemy_stesti | int | |
| enemy_hp | int | Počáteční HP nepřítele (doporučeno: 10–20) |
| player_attribute | enum | Atribut hráče použitý v souboji: `sila` \| `inteligence` \| `obratnost` |
| enemy_attribute | enum | Atribut nepřítele použitý v souboji: `sila` \| `inteligence` \| `obratnost` |
| victory_node_id | uuid | Kam čtenář přejde při výhře |
| defeat_node_id | uuid | Kam čtenář přejde při prohře |

**Soubojový atribut:** Tvůrce při konfiguraci combat uzlu zvolí, jaký atribut hráče a nepřítele se v souboji použije (např. fyzický souboj = Síla vs. Síla; záludná past = Inteligence vs. Inteligence; uhýbání = Obratnost vs. Obratnost). Štěstí se v tomto výběru nepoužívá — je vyhrazeno pro "zkusit štěstí" mechaniku.

### Reader progress (localStorage)
Progres čtenáře se neukládá do databáze — pouze do `localStorage` prohlížeče. Klíč: `gamebooker_session_{gamebook_id}`.

```typescript
interface ReaderSession {
  gamebookId: string
  gamebookUpdatedAt: string  // detekce zastaralé session (změna gamebooku)
  currentNodeId: string
  character: {
    name: string
    avatarId: string
    sila: number
    inteligence: number
    obratnost: number
    stesti: number
    hp: number        // aktuální HP
    hpMax: number     // maximální HP (= Síla + 10)
  }
  inventory: string[]        // item ids
  visitedNodes: string[]     // pro minimapu
  createdAt: string
  updatedAt: string
}
```

**Zastaralá session:** Při načtení gamebooku se porovná `gamebookUpdatedAt` v localStorage s `updated_at` z databáze. Pokud se liší (tvůrce mezitím gamebook upravil), zobrazí se upozornění a hráč může zvolit: pokračovat se stávající session nebo začít znovu.

**HP systém:** Počáteční HP hráče = `sila + 10`. Poškození v souboji = `max(1, vítězný hod - poražený hod)` za každé kolo. Nepřítel má HP dle `combat_configs.enemy_hp`.

---

## AI vrstva

### Provider abstraction

```typescript
interface LLMProvider {
  chat(messages: Message[], options?: LLMOptions): Promise<string>
  stream(messages: Message[], options?: LLMOptions): AsyncIterable<string>
}
```

Implementace: `AnthropicProvider`, `OpenAIProvider`. Konfigurace přes env proměnné:

```
LLM_PROVIDER=anthropic   # nebo openai
LLM_MODEL=claude-sonnet-4-6
LLM_API_KEY=...
```

### Systémové prompty (češtině)

Každá fáze tvorby má vlastní šablonu promptu:

| Soubor | Účel |
|---|---|
| `brainstorm-conversation.ts` | Konverzační průvodce pro fázi brainstormingu |
| `generate-outline.ts` | Převod základu příběhu na strukturu uzlů (JSON) |
| `generate-node-text.ts` | Generování plného textu pro jeden uzel |
| `suggest-branches.ts` | Návrh nových větví příběhu |

AI vždy vrací strukturovaný JSON pro generování osnovy/uzlů (validován Zodem) a volný text v češtině pro konverzační fázi. Streaming se používá pro generování textu uzlů.

### Bezpečnost
Všechna volání LLM probíhají přes server-side API routes Next.js — API klíč nikdy není vystaven v prohlížeči. Základní rate limiting per uživatel.

---

## Tvůrčí proces (4 fáze)

### Fáze 1 — Brainstorming s AI
- AI chatbot (v češtině) klade otázky jednu po druhé: žánr/prostředí, časové období, hlavní postavy, ústřední konflikt, tón příběhu
- Po ~6–8 výměnách AI vygeneruje **Základ příběhu**: název, prostředí, postavy, hlavní oblouk, 2–3 možné konce
- Tvůrce může editovat základ inline nebo požádat AI o úpravu přirozeným jazykem

### Fáze 2 — Osnova příběhu
- AI vygeneruje node graf z Základu příběhu
- Vizuální canvas (React Flow) zobrazuje uzly jako kartičky propojené šipkami
- Každý uzel má zatím pouze název a jednověté shrnutí
- Tvůrce může: přetahovat uzly, přidávat/mazat uzly, kreslit nová spojení
- AI je dostupná v plovoucím panelu: "přidej vedlejší příběh kde hráč najde meč"

### Fáze 3 — Generování textu
- Klik na uzel → AI vygeneruje plný text příběhu (streaming, text se objevuje postupně)
- Tvůrce může: regenerovat, editovat ručně, požádat AI o úpravy ("udělej to napínavější")
- Na každém uzlu lze nakonfigurovat: nalezené předměty, souboj, typ uzlu
- Hromadné generování je mimo scope v1 — tvůrce generuje uzly jednotlivě

### Fáze 4 — Náhled a publikování
- Plnohodnotný čtenářský náhled (tvůrce si book přečte jako hráč)
- Validační panel před publikováním blokuje publish dokud existují: osiřelé uzly, uzly bez voleb které nemají typ `ending`, chybějící `victory_node_id` nebo `defeat_node_id` u combat uzlů
- Jedno kliknutí publikuje gamebook → okamžitě viditelný ve veřejné knihovně
- Po publikování lze stále editovat a aktualizovat (čtenáři s aktivní session dostanou upozornění)

---

## Čtenářský zážitek

### Vytvoření postavy
- Animované hody 2d6 pro každý atribut (Síla, Inteligence, Obratnost, Štěstí) se zvukovým efektem
- Hráč může hodit znovu celou sadu maximálně **2×** (celkem 3 pokusy), poté jsou hodnoty uzamčeny
- 3 body k přerozdělení dle vlastního uvážení (vždy dostupné i po re-rollu)
- Jméno postavy + volba avatar ikony
- Uloženo do localStorage pro daný gamebook

### Čtení
- Dva vizuální motivy (přepínatelné): **Pergamen** (teplá krémová, serif písmo, inkoust) a **Noc** (tmavé pozadí, zlatý text)
- Velké, čitelné písmo: Crimson Text (serif)
- Text se objevuje s plynulým fade-in efektem
- Volby jako stylizovaná tlačítka ve spodní části po načtení textu

### Inventář
- Při dosažení uzlu s předmětem se text přirozeně zmiňuje o nálezu ("Nalézáš starý meč...")
- Po přečtení textu: animovaný odznak z rohu obrazovky s ikonou a názvem předmětu
- Ikona batohu v horním rohu → slide-in drawer se seznamem předmětů (název, popis, bonusy)

### Souboj
1. Při dosažení combat uzlu: přechod na dedikovanou obrazovku souboje
2. **3 kola**: každé kolo obě strany hodí 1d6 (animovaná kostka) + příslušný atribut
3. Předměty s bojovými bonusy se automaticky aplikují a zobrazí
4. Po každém kole: vítěz/poražený s dramaticky ubývajícími HP bary
5. **Štěstí mechanika**: 1× za souboj může hráč "zkusit štěstí" — bonusový hod měnící prohru na remízu
6. Výsledek: 2 z 3 kol rozhoduje vítěze (nebo dřívější dosažení 0 HP)
7. Výhra → příběh pokračuje; prohra → uzel porážky (nakonfigurovaný tvůrcem)

### Progres a návrat
- Miniaturní mapa navštívených uzlů (bez spoilerů nenavštívených)
- Při návratu na stránku: tlačítko "Pokračovat" → okamžité obnovení hry

---

## UI/UX Design

### Vizuální styl
- Primární barva: hluboká indigová/námořnická modrá se zlatými akcenty
- UI chrome: Inter (sans-serif); čtenářský mód: Crimson Text (serif)
- Moderní, mírně magická estetika — ne dětská, ale přívětivá

### Barvy uzlů v editoru
| Typ | Barva |
|---|---|
| story | Indigo |
| combat | Červená |
| item_discovery | Jantarová |
| ending | Smaragdová |

### Navigace (URL struktura)
| URL | Popis |
|---|---|
| `/` | Veřejná knihovna + landing page |
| `/prihlasit` | Přihlášení tvůrce |
| `/tvorit` | Dashboard tvůrce (chráněno) |
| `/tvorit/[id]` | Editor gamebooku |
| `/hrat/[id]` | Hraní gamebooku (veřejné) |

### Veřejná knihovna
- Dostupná bez přihlášení
- Kartičky: obálka, název, jméno tvůrce, počet uzlů, žánrový tag
- Vyhledávací pole + jednoduché filtry (žánr, délka)

---

## Nasazení a infrastruktura

| Služba | Použití | Tier |
|---|---|---|
| Vercel | Hosting Next.js aplikace | Free |
| Supabase | PostgreSQL + Auth | Free (500 MB DB, 50k MAU) |
| LLM provider | AI generování obsahu | Dle volby tvůrce |

**Environment variables (Vercel dashboard):**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
LLM_PROVIDER
LLM_MODEL
LLM_API_KEY
```

---

## Mimo scope (v1 prototyp)

- Mobilní aplikace (architektura ji umožňuje, implementace v budoucnu)
- Kolaborativní editace (více tvůrců na jednom gamebooku)
- Přihlášení čtenářů a cloudový progres
- Platby nebo prémiové funkce
- Obrázky generované AI pro uzly
- Notifikace nebo komentáře
- Hromadné generování textu uzlů ("vygeneruj celou linku")

## Známá omezení

- Vercel free tier má timeout 10 s pro serverless funkce; streaming LLM odpovědí pro dlouhé texty může narážet na tento limit — doporučeno sledovat a v případě potřeby přejít na Vercel Pro nebo rozdělit generování na kratší segmenty
- Systémové prompty a UI jsou v češtině; přidání dalšího jazyka vyžaduje samostatný i18n pass
