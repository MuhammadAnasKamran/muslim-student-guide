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

# 1. PRAYER ON CAMPUS

Two prayer rooms are open to all PolyU students. Both are opened with your student
card — there is no form to fill in and no office to visit.

### Z302a
- tag: Main prayer room
- location: Z Core, room Z302a
- access: Tap your student card on the card reader outside the room.
- arrangement: Separate male and female areas, divided by curtains.
- wudu: Use the nearby washrooms. There is no wudu facility inside the room.
- jummah: yes
- jummah-note: Jummah is held here. The time changes through the year, so check the live prayer timings display before you come.
- link: https://mosque-prayer-display-screen-cyan.vercel.app
- link-label: Z Core prayer timings

### PQ502a
- tag: Second prayer room
- location: PQ Core, room PQ502a
- access: Tap your student card on the card reader outside the room.
- arrangement: Separate male and female areas, divided by curtains.
- wudu: Use the nearby washrooms.
- jummah: no
- jummah-note: Daily prayers only. For Jummah, go to Z302a.

## 1.1 Washrooms with bidets

### Core C
- floors: All floors
- feature: Bidet

### Core E
- floors: All floors
- feature: Bidet

## 1.2 Hall prayer rooms

> Residents only. If you do not live in the halls, use Z302a or PQ502a on campus.

### Hung Hom Halls prayer room
- location: 2/F, beside the piano room
- access: Hall residents only

### Homantin Halls prayer room
- location: 1/F, beside the gym
- access: Hall residents only

---

# 2. FOOD ON CAMPUS

Opening hours are deliberately not recorded anywhere in this guide. They change too
often to keep accurate, and a wrong opening time is worse than none.

### Halal by The Forest
- where: Z Cafe, Z Core
- status: certified
- link: https://www.polyu.edu.hk/cfso/campus-environment-and-facilities/catering-facilities/catering-outlets/z-cafe/

### The Forest — VA Student Canteen
- where: G/F, VA Student Canteen
- status: certified
- menu: Curry with chicken thigh · Curry with beef brisket · Curry with fish cutlet
- price: approx. HK$50
- link: https://www.polyu.edu.hk/cfso/campus-environment-and-facilities/catering-facilities/catering-outlets/va-student-canteen/

### The Forest — Hung Hom Bay Campus
- where: Hung Hom Bay Campus canteen
- status: certified
- menu: Curry with chicken thigh · Curry with beef brisket · Curry with fish cutlet
- price: approx. HK$50
- note: Same menu and prices as the VA Student Canteen.
- link: https://www.polyu.edu.hk/cfso/campus-environment-and-facilities/catering-facilities/catering-outlets/hhsh-canteen/

### Pacific Coffee
- where: X Cafe, X Core
- status: certified-section
- note: Pre-packaged halal certified sandwiches. Subject to availability.
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
- note: The range changes, so do not rely on a fixed list. Check the packaging for a halal certificate or logo before buying. Garden sandwich bread is confirmed certified.
- link: https://www.polyu.edu.hk/fo/visitors/campus-wide-facilities/
- TODO: list the specific certified instant noodles, juices and snacks if anyone verifies them

> No other PolyU catering outlet serves halal food.

---

# 3. FOOD NEAR THE HALLS

Both are a short walk from Hung Hom and Homantin. Use whichever is closer to you.

### Turnep Roast & Relish
- walk: About 7 minutes from Homantin Halls, 5 minutes from Hung Hom Halls
- perk: Student discount available
- link: https://maps.app.goo.gl/yXLLkUV1xu2xQqSq9
- TODO: confirm halal certification status

### Ebenezers
- walk: About 5 minutes from Homantin Halls
- status: certified
- link: https://maps.app.goo.gl/Qa2TDpEVNJesHDoQA

---

# 4. DELIVERY AND HOME KITCHENS

> **Please read.** These are community-known home kitchens, not certified
> establishments. MUSA shares them as a service to students and does not verify them.
> Please use your own judgement.

All three: South Asian cooked meals, several options daily, around HK$40 per meal.

### Pakistani Halal Food
- status: unverified
- sells: South Asian cooked meals, several options daily
- price: around HK$40 per meal
- link: https://chat.whatsapp.com/LWmReNeQYwHFVJJMLz2yZ9
- TODO: delivery area

### Bangladeshi Halal Food (Ruby Foods)
- status: unverified
- sells: South Asian cooked meals, several options daily
- price: around HK$40 per meal
- link: https://chat.whatsapp.com/LcFJXcxJQ3jE4zf7vVgqMd
- TODO: delivery area

### Halal Food Delivery HK (Maryam Aunty)
- status: unverified
- sells: South Asian cooked meals, several options daily
- price: around HK$40 per meal
- link: https://chat.whatsapp.com/FbKoipG7m17GC9HOghzt2C
- TODO: delivery area

---

# 5. GROCERIES

## 5.1 Delivery

### Waqas Store
- sells: All groceries
- delivery: Free delivery to both Hung Hom and Homantin halls
- link: https://chat.whatsapp.com/Bkfea00tZUdBsbP7dyuhM9

## 5.2 Shops

### ParknShop (near campus)
- address: Shop 729–733, Level 7, Metropolis Mall, 6 Metropolis Drive, Hung Hom
- status: check-packaging
- what: Halal certified items and halal bread
- link: https://maps.app.goo.gl/yF8Y3U2ATM7XPgvEA

### ParknShop (near Homantin Halls)
- address: Shop 1–2, LG/F, Ka Yee Lau, Ka Wai Chuen, Ma Tau Wai Road, Hung Hom
- status: check-packaging
- what: Halal certified items and halal bread
- link: https://maps.app.goo.gl/XvX6UypsnyTqaWLs9

### ParknShop (Whampoa)
- address: Shop 26, G/F, The Whampoa Site 3, 3 Whampoa Street, Hung Hom
- status: check-packaging
- what: Halal certified items and halal bread
- link: https://maps.app.goo.gl/VP4dTyGSyXyiVi7v9

### Taste
- status: certified-section
- what: Has a halal section
- link: https://maps.app.goo.gl/CzzknMa8QMHbeNP16
- TODO: branch address

### Wellcome
- status: check-packaging
- what: Halal certified items and halal bread
- link: https://maps.app.goo.gl/McTCgPdHfdwhYRB48
- TODO: branch address

### DS Groceries
- address: Shop 18B, B/F, United Building (Lung To Court), 1–7 Wu Kwong Street, Hung Hom
- status: check-packaging
- what: Halal certified items
- link: https://maps.app.goo.gl/KyaoL41JAT5GJazu7

### Ka Hing Supermarket
- address: Shop 17G1B, B/F, Luen Shing Building, Po Loi Street, Hung Hom
- status: check-packaging
- what: Halal certified snacks only — no halal meat
- link: https://maps.app.goo.gl/ZbyruHjwpNYpqduW7

## 5.3 Notes

### Halal bread
- note: Garden sandwich bread is halal certified and is stocked at 7-Eleven, Circle K, ParknShop and Wellcome.
- link: https://www.garden.com.hk/en/product/hong-kong/retail/bread/sandwich-bread/

### A general rule
- note: Rather than memorising product lists, check the packaging for a halal certificate or logo. What is stocked changes often.

---

# 6. MOSQUES AND PRAYER SPACES

## 6.1 Closest to PolyU

### Discover Islam Hong Kong
- district: Hung Hom
- address: Hung Hom, Kowloon
- notes: Five daily prayers and Friday khutbah. Check timings on Athan Plus or confirm when you arrive.
- link: https://maps.app.goo.gl/fpzSoC8n3iSdeTu69
- TODO: exact street address, confirmed Jummah time, whether students are welcome

### To Kwa Wan Prayer Space
- district: To Kwa Wan
- address: G/F, 19 San Shan Road, To Kwa Wan, Kowloon
- notes: Neighbourhood musolla with wudu facility.
- TODO: map link

### Masjid Ibrahim
- district: Yau Ma Tei
- address: Shop C-1, G/F, Executive Building, 10–16 Ferry Street, Yau Ma Tei
- notes: Active community hub. Daily prayers and classes.
- TODO: map link

## 6.2 Major mosques

### Kowloon Mosque & Islamic Centre
- district: Tsim Sha Tsui
- address: 105 Nathan Road, Tsim Sha Tsui, Kowloon
- notes: Library, madrasa and women's section. Close to the halal restaurants of TST.
- jummah: yes
- TODO: map link

### Masjid Ammar & Osman Ramju Sadick Islamic Centre
- district: Wan Chai
- address: 40 Oi Kwan Road, Wan Chai, Hong Kong Island
- notes: Halal canteen on 5/F, HK$50–100, open 10am–8pm. Home of the Islamic Union of Hong Kong and the Hong Kong Islamic Youth Association. Free community iftar during Ramadan.
- jummah: yes
- link: https://maps.app.goo.gl/h5x7Y5Dc5D3g8cFR7

### Jamia Mosque
- district: Mid-Levels
- address: 30 Shelley Street, Mid-Levels, Central
- notes: The oldest mosque in Hong Kong, built in 1890. Grade I historic building.
- jummah: yes
- TODO: map link

### Chai Wan Mosque
- district: Chai Wan
- address: 21 Cape Collinson Road, Chai Wan, Hong Kong Island
- notes: Beside the Muslim cemetery. Quiet, green surroundings.
- TODO: map link

> **Friday prayers.** Kowloon Mosque, Jamia Mosque and Masjid Ammar hold full Jumu'ah
> congregations, with sermons in Arabic, English and Urdu or Cantonese. Arrive about
> 30 minutes early, as they fill up.

## 6.3 District musollas

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

# 7. APPS AND USEFUL LINKS

### Athan Plus
- note: Salah timings for mosques and Islamic centres across Hong Kong.
- link: https://play.google.com/store/apps/details?id=com.masjidal.athanplus
- TODO: iOS App Store link

### Z Core prayer timings display
- note: Live prayer and Jummah timings for the Z302a prayer room.
- link: https://mosque-prayer-display-screen-cyan.vercel.app

### IUHK Halal Food List
- note: Hong Kong–wide halal listing from the Islamic Union of Hong Kong. Check the date on the document before relying on it.
- link: https://www.iuhk.org/images/Others/Halah-Food/Halal-List_en.pdf
