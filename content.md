# MUSA Muslim Guide — Content

This file is the single source of truth. The website and the PDF are both generated
from it. Edit here, rebuild, and both stay in sync. Never edit the website or the PDF
directly — your changes will be wiped on the next build.

---

## HOW TO EDIT THIS FILE

**The format is strict. Parsers are unforgiving. Follow these five rules.**

1. `###` starts a new entry. The text after it is the entry's name.
2. Every fact under an entry is a bullet in the form `- key: value`
3. Never rename a key. Add new ones only if the build script knows about them.
4. Leave a key out entirely if you don't have the information. Do **not** write
   `- address: TBC` or `- address: ???` — an absent key renders as nothing, a
   placeholder renders as the word "TBC" on a poster.
5. Anything marked `TODO:` is a known gap. Delete the TODO line when you fill it.

**Allowed values for `status`** — use these exact words, nothing else:

| Value | Meaning |
|---|---|
| `certified` | Holds halal certification |
| `certified-section` | Only part of the shop or menu is certified |
| `check-packaging` | Some products are certified; look for the logo yourself |
| `unverified` | Community-known. MUSA has not confirmed anything. |

**Before you commit a change**, run the validator:

```bash
npm run check
```

It will tell you about unknown keys, bad status values, and dead links.

---

## META

- title: The Muslim Guide to PolyU
- subtitle: Prayer, halal food and essentials for Muslim students at PolyU
- org: MUSA — PolyU Muslim Association
- version: 1.0
- updated: 2026-09-15
- site: TODO: live URL once hosting is decided
- contact: TODO: MUSA email
- instagram: TODO: MUSA Instagram handle
- whatsapp: TODO: MUSA WhatsApp or join link

---

# Prayer Facilities

## Prayer Rooms

Open to all students.

### Z302a
- tag: Main prayer room
- location: Z Core
- access: Tap student card at the door
- arrangement: Men's and women's areas, curtained
- wudu: No wudu area inside. Use nearby washrooms.
- jummah: yes
- jummah-note: Held here. Time varies through the year — check live times.
- link: https://mosque-prayer-display-screen-cyan.vercel.app
- link-label: Live prayer times

### PQ502a
- tag: Second prayer room
- location: PQ Core
- access: Tap student card at the door
- arrangement: Men's and women's areas, curtained
- wudu: Use nearby washrooms.
- jummah: no
- jummah-note: Daily prayers only. Jummah: go to Z302a.

## Washrooms with Bidets

### Core C
- floors: All floors

### Core E
- floors: All floors

## Hall Prayer Rooms

> **Hall residents only.** Others: use Z302a or PQ502a.

### Hung Hom Halls
- location: 2/F, beside the piano room

### Homantin Halls
- location: 1/F, beside the gym

---

# Mosques of Hong Kong

### Athan Plus
- note: Prayer times for HK mosques
- link: https://play.google.com/store/apps/details?id=com.masjidal.athanplus
- TODO: iOS App Store link

> **Friday prayer:** full Jumu'ah at Kowloon, Jamia and Ammar. Sermons in Arabic, English, Urdu or Cantonese. Arrive 30 min early — they fill up.

## Near PolyU

### Discover Islam Hong Kong
- district: Hung Hom
- address: Hung Hom, Kowloon
- notes: 5 daily prayers and Friday khutbah. Times on Athan Plus, or ask on arrival.
- link: https://maps.app.goo.gl/fpzSoC8n3iSdeTu69
- TODO: exact street address, confirmed Jummah time, whether students are welcome

### To Kwa Wan Prayer Space
- district: To Kwa Wan
- address: G/F, 19 San Shan Road, To Kwa Wan, Kowloon
- notes: Local musolla with wudu area
- TODO: map link

### Masjid Ibrahim
- district: Yau Ma Tei
- address: Shop C-1, G/F, Executive Building, 10–16 Ferry Street, Yau Ma Tei
- notes: Community hub. Daily prayers and classes.
- TODO: map link

## Major Mosques

### Kowloon Mosque & Islamic Centre
- district: Tsim Sha Tsui
- address: 105 Nathan Road, Tsim Sha Tsui, Kowloon
- notes: Women's section, library, madrasa. Near TST halal restaurants.
- jummah: yes
- TODO: map link

### Masjid Ammar & Osman Ramju Sadick Islamic Centre
- district: Wan Chai
- address: 40 Oi Kwan Road, Wan Chai, Hong Kong Island
- notes: Halal canteen 5/F (HK$50–100, 10am–8pm). Free iftar in Ramadan. Home of the Islamic Union of HK and HK Islamic Youth Association.
- jummah: yes
- link: https://maps.app.goo.gl/h5x7Y5Dc5D3g8cFR7

### Jamia Mosque
- district: Mid-Levels
- address: 30 Shelley Street, Mid-Levels, Central
- notes: Oldest mosque in HK (1890). Grade I historic building.
- jummah: yes
- TODO: map link

### Chai Wan Mosque
- district: Chai Wan
- address: 21 Cape Collinson Road, Chai Wan, Hong Kong Island
- notes: Beside the Muslim cemetery. Quiet and green.
- TODO: map link

## Local Musollas

### Kwun Tong Musolla
- district: Kwun Tong
- address: Flat D, 4/F, Yip Fat Factory Building Phase 1, 77 Hoi Yuen Road, Kwun Tong

### Tung Chung Islamic Centre
- district: Lantau
- address: Yat Tung Estate / Caribbean Coast area, Tung Chung, Lantau
- jummah: yes

### Tuen Mun Musolla
- district: Tuen Mun
- address: Shop 26, G/F, Hoi Hoi Building, 15 Hoi Wong Road, Tuen Mun

---

# Halal Food

## On Campus

Hours not listed — they change often.

### Halal by The Forest
- where: Z Cafe, Z Core
- status: certified
- link: https://www.polyu.edu.hk/cfso/campus-environment-and-facilities/catering-facilities/catering-outlets/z-cafe/

### The Forest — VA Student Canteen
- where: G/F, VA Student Canteen
- status: certified
- menu: Curry with chicken thigh, beef brisket or fish cutlet
- price: About HK$50
- link: https://www.polyu.edu.hk/cfso/campus-environment-and-facilities/catering-facilities/catering-outlets/va-student-canteen/

### The Forest — Hung Hom Bay Campus
- where: Hung Hom Bay Campus canteen
- status: certified
- menu: Curry with chicken thigh, beef brisket or fish cutlet
- price: About HK$50
- note: Same menu and price as VA Canteen
- link: https://www.polyu.edu.hk/cfso/campus-environment-and-facilities/catering-facilities/catering-outlets/hhsh-canteen/

### Pacific Coffee
- where: X Cafe, X Core
- status: certified-section
- note: Pre-packed certified sandwiches, when in stock
- link: https://www.polyu.edu.hk/cfso/campus-environment-and-facilities/catering-facilities/catering-outlets/x-cafe/

### Fresh Up vending machine
- where: VA210
- status: check-packaging
- note: Halal snacks.

### Vending machine
- where: Homantin Halls, G/F canteen
- status: check-packaging
- note: Frozen halal meals.
- TODO: confirm the machine's brand name

### 7-Eleven
- where: Campus-wide
- status: check-packaging
- note: Range changes. Check each pack for a halal logo. Garden sandwich bread is certified.
- link: https://www.polyu.edu.hk/fo/visitors/campus-wide-facilities/
- TODO: list the specific certified instant noodles, juices and snacks if anyone verifies them

> No other PolyU catering outlet serves halal food.

## Near the Halls

Short walk from both halls.

### Turnep Roast & Relish
- walk: 7 min walk from Homantin, 5 min from Hung Hom
- perk: Student discount
- link: https://maps.app.goo.gl/yXLLkUV1xu2xQqSq9
- TODO: confirm halal certification status

### Ebenezers
- walk: 5 min walk from Homantin Halls
- status: certified
- link: https://maps.app.goo.gl/Qa2TDpEVNJesHDoQA

## Home Kitchens (Delivery)

> **Not certified.** Community-known home kitchens, not checked by MUSA. Use your own judgement.

### Pakistani Halal Food
- status: unverified
- sells: South Asian meals, several options daily
- price: About HK$40 a meal
- link: https://chat.whatsapp.com/LWmReNeQYwHFVJJMLz2yZ9
- TODO: delivery area

### Bangladeshi Halal Food (Ruby Foods)
- status: unverified
- sells: South Asian meals, several options daily
- price: About HK$40 a meal
- link: https://chat.whatsapp.com/LcFJXcxJQ3jE4zf7vVgqMd
- TODO: delivery area

### Halal Food Delivery HK (Maryam Aunty)
- status: unverified
- sells: South Asian meals, several options daily
- price: About HK$40 a meal
- link: https://chat.whatsapp.com/FbKoipG7m17GC9HOghzt2C
- TODO: delivery area

## Beyond PolyU

### IUHK Halal Food List
- note: Full Hong Kong halal list by IUHK. Check its date first.
- link: https://www.iuhk.org/images/Others/Halah-Food/Halal-List_en.pdf

---

# Halal Groceries

## Tips

### A general rule
- note: Stock changes often. Check each pack for a halal logo.

### Halal bread
- note: Garden sandwich bread is certified. Sold at 7-Eleven, Circle K, ParknShop, Wellcome.
- link: https://www.garden.com.hk/en/product/hong-kong/retail/bread/sandwich-bread/

## Delivery

### Waqas Store
- sells: All groceries
- delivery: Free delivery to both halls
- link: https://chat.whatsapp.com/Bkfea00tZUdBsbP7dyuhM9

## Shops

### ParknShop (near campus)
- address: Shop 729–733, Level 7, Metropolis Mall, 6 Metropolis Drive, Hung Hom
- status: check-packaging
- what: Certified items and halal bread
- link: https://maps.app.goo.gl/yF8Y3U2ATM7XPgvEA

### ParknShop (near Homantin Halls)
- address: Shop 1–2, LG/F, Ka Yee Lau, Ka Wai Chuen, Ma Tau Wai Road, Hung Hom
- status: check-packaging
- what: Certified items and halal bread
- link: https://maps.app.goo.gl/XvX6UypsnyTqaWLs9

### ParknShop (Whampoa)
- address: Shop 26, G/F, The Whampoa Site 3, 3 Whampoa Street, Hung Hom
- status: check-packaging
- what: Certified items and halal bread
- link: https://maps.app.goo.gl/VP4dTyGSyXyiVi7v9

### Taste
- status: certified-section
- what: Has a halal section
- link: https://maps.app.goo.gl/CzzknMa8QMHbeNP16
- TODO: branch address

### Wellcome
- status: check-packaging
- what: Certified items and halal bread
- link: https://maps.app.goo.gl/McTCgPdHfdwhYRB48
- TODO: branch address

### DS Groceries
- address: Shop 18B, B/F, United Building (Lung To Court), 1–7 Wu Kwong Street, Hung Hom
- status: check-packaging
- what: Certified items
- link: https://maps.app.goo.gl/KyaoL41JAT5GJazu7

### Ka Hing Supermarket
- address: Shop 17G1B, B/F, Luen Shing Building, Po Loi Street, Hung Hom
- status: check-packaging
- what: Certified snacks only. No halal meat.
- link: https://maps.app.goo.gl/ZbyruHjwpNYpqduW7
