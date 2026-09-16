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

### Z302a
- access: Student card entry
- arrangement: Men's & women's areas
- prayers: Daily prayers + Jummah
- link: https://mosque-prayer-display-screen-cyan.vercel.app
- link-label: Live prayer times

### PQ502a
- access: Student card entry
- arrangement: Men's & women's areas
- prayers: Daily prayers

## Hall Prayer Rooms

### Hung Hom Halls
- location: 2/F, beside the piano room
- access: Residents only

### Homantin Halls
- location: 1/F, beside the gym
- access: Residents only

---

# Muslim-Friendly Washrooms

### Core C
- floors: All floors
- feature: Bidet

### Core E
- floors: All floors
- feature: Bidet

---

# Mosques of Hong Kong

### Athan Plus
- note: Prayer times for HK mosques
- link: https://play.google.com/store/apps/details?id=com.masjidal.athanplus
- TODO: iOS App Store link

> **Friday prayer:** Kowloon, Jamia and Ammar hold full Jumu'ah. Sermons in Arabic, English, Urdu or Cantonese. Arrive 30 min early.

## Near PolyU

### Discover Islam Hong Kong
- district: Hung Hom
- address: Hung Hom, Kowloon
- tags: 5 daily prayers · Friday khutbah
- notes: Times on Athan Plus, or ask on arrival.
- link: https://maps.app.goo.gl/fpzSoC8n3iSdeTu69
- TODO: exact street address, confirmed Jummah time, whether students are welcome

### To Kwa Wan Prayer Space
- district: To Kwa Wan
- address: G/F, 19 San Shan Road, To Kwa Wan, Kowloon
- tags: Local musolla · Wudu area
- TODO: map link

### Masjid Ibrahim
- district: Yau Ma Tei
- address: Shop C-1, G/F, Executive Building, 10–16 Ferry Street, Yau Ma Tei
- tags: Community hub · Daily prayers · Classes
- TODO: map link

## Major Mosques

### Kowloon Mosque & Islamic Centre
- district: Tsim Sha Tsui
- address: 105 Nathan Road, Tsim Sha Tsui, Kowloon
- tags: Women's section · Library · Madrasa · Near TST halal food
- jummah: yes
- TODO: map link

### Masjid Ammar & Osman Ramju Sadick Islamic Centre
- district: Wan Chai
- address: 40 Oi Kwan Road, Wan Chai, Hong Kong Island
- tags: Halal canteen 5/F · HK$50–100 · 10am–8pm · Free iftar in Ramadan · Islamic Union of HK · HK Islamic Youth Association
- jummah: yes
- link: https://maps.app.goo.gl/h5x7Y5Dc5D3g8cFR7

### Jamia Mosque
- district: Mid-Levels
- address: 30 Shelley Street, Mid-Levels, Central
- tags: Oldest mosque in HK (1890) · Grade I historic building
- jummah: yes
- TODO: map link

### Chai Wan Mosque
- district: Chai Wan
- address: 21 Cape Collinson Road, Chai Wan, Hong Kong Island
- tags: Beside the Muslim cemetery · Quiet and green
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

# Halal Food Near You

## Campus

Hours change often, so they are not listed.

### Halal by The Forest
- where: Z Cafe, Z Core
- status: certified
- link: https://www.polyu.edu.hk/cfso/campus-environment-and-facilities/catering-facilities/catering-outlets/z-cafe/

### The Forest — VA Student Canteen
- where: G/F, VA Student Canteen
- status: certified-section
- price: ≈HK$50
- tags: Chicken thigh curry · Beef brisket curry · Fish cutlet curry
- warning: Only these 3 meals are halal. Other dishes are not.
- link: https://www.polyu.edu.hk/cfso/campus-environment-and-facilities/catering-facilities/catering-outlets/va-student-canteen/

### Pacific Coffee
- where: X Cafe, X Core
- status: check-packaging
- tags: Some items halal certified · Check before buying
- link: https://www.polyu.edu.hk/cfso/campus-environment-and-facilities/catering-facilities/catering-outlets/x-cafe/

### Campus vending machine
- where: VA210
- status: certified
- tags: Snacks only · Halal logo on machine

### 7-Eleven
- where: Campus-wide
- status: check-packaging
- tags: Halal items available · Garden sandwich bread certified
- note: Range changes. Check each pack for a halal logo.
- link: https://www.polyu.edu.hk/fo/visitors/campus-wide-facilities/
- TODO: list the specific certified instant noodles, juices and snacks if anyone verifies them

## Halls

### Hung Hom Halls Canteen
- where: Hung Hom Halls
- status: certified-section
- price: ≈HK$50
- tags: Chicken thigh curry · Beef brisket curry · Fish cutlet curry
- warning: Only these 3 meals are halal. Other dishes are not.
- link: https://www.polyu.edu.hk/cfso/campus-environment-and-facilities/catering-facilities/catering-outlets/hhsh-canteen/

### Homantin Halls vending machine
- where: Homantin Halls, G/F canteen
- status: check-packaging
- tags: Frozen halal meals · Check before buying
- warning: The Homantin canteen itself has no halal food.

## Delivery

> **Not certified.** Community-known home kitchens. Not checked by MUSA. Use your own judgement.

### Halal Food Delivery Hong Kong
- status: unverified
- price: ≈HK$40 a meal
- sells: South Asian meals
- link: https://chat.whatsapp.com/FbKoipG7m17GC9HOghzt2C
- TODO: delivery area

### Bangladeshi Halal Food
- status: unverified
- price: ≈HK$40 a meal
- sells: South Asian meals
- link: https://chat.whatsapp.com/LcFJXcxJQ3jE4zf7vVgqMd
- TODO: delivery area

### Pakistani Halal Food
- status: unverified
- price: ≈HK$40 a meal
- sells: South Asian meals
- link: https://chat.whatsapp.com/LWmReNeQYwHFVJJMLz2yZ9
- TODO: delivery area

## More in Hong Kong

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
- tags: All groceries
- delivery: Free delivery to both halls
- link: https://chat.whatsapp.com/Bkfea00tZUdBsbP7dyuhM9

## Shops

### ParknShop (near campus)
- address: Shop 729–733, Level 7, Metropolis Mall, 6 Metropolis Drive, Hung Hom
- status: check-packaging
- tags: Certified items · Halal bread
- link: https://maps.app.goo.gl/yF8Y3U2ATM7XPgvEA

### ParknShop (near Homantin Halls)
- address: Shop 1–2, LG/F, Ka Yee Lau, Ka Wai Chuen, Ma Tau Wai Road, Hung Hom
- status: check-packaging
- tags: Certified items · Halal bread
- link: https://maps.app.goo.gl/XvX6UypsnyTqaWLs9

### ParknShop (Whampoa)
- address: Shop 26, G/F, The Whampoa Site 3, 3 Whampoa Street, Hung Hom
- status: check-packaging
- tags: Certified items · Halal bread
- link: https://maps.app.goo.gl/VP4dTyGSyXyiVi7v9

### Taste
- status: certified-section
- tags: Halal section
- link: https://maps.app.goo.gl/CzzknMa8QMHbeNP16
- TODO: branch address

### Wellcome
- status: check-packaging
- tags: Certified items · Halal bread
- link: https://maps.app.goo.gl/McTCgPdHfdwhYRB48
- TODO: branch address

### DS Groceries
- address: Shop 18B, B/F, United Building (Lung To Court), 1–7 Wu Kwong Street, Hung Hom
- status: check-packaging
- tags: Certified items
- link: https://maps.app.goo.gl/KyaoL41JAT5GJazu7

### Ka Hing Supermarket
- address: Shop 17G1B, B/F, Luen Shing Building, Po Loi Street, Hung Hom
- status: check-packaging
- tags: Certified snacks · No halal meat
- link: https://maps.app.goo.gl/ZbyruHjwpNYpqduW7
