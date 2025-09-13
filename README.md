# 🎓 Student Financial Aid — College Cost Transparency for All

**Student Financial Aid** helps students and families understand the **real cost of college** by making financial aid simple and transparent.  
It uses the **U.S. Department of Education College Scorecard API** and integrates clear **need-based** and **merit-based (GPA)** logic to estimate what students may actually pay.

---

## 🚀 Problem
College pricing is confusing. Many students—especially from low-income or first-gen backgrounds—don’t learn their true out-of-pocket cost until it’s too late, leading to poor choices and higher debt.

---

## 💡 Solution
Student Financial Aid provides:
- 🔍 A **search tool** to look up U.S. colleges  
- 📊 A clear **estimated financial breakdown** (need grants, merit scholarships, work-study, loans, out-of-pocket)  
- 🍩 A **donut chart** that makes numbers easy to understand  
- 🧮 **Transparent formulas** so users can see exactly how estimates are calculated  

---

## 🌍 Impact
By pairing official data with transparent estimation rules, Student Financial Aid empowers smarter decisions, reduces surprise costs, and supports **education equity**.

---

## ✨ Features
- 🔎 Search any U.S. college by name  
- 📊 Visualize **Need Grants**, **Merit Scholarships**, **Work-Study**, **Loans**, and **Out-of-Pocket**  
- 🧠 **Merit (GPA) logic** explicitly modeled as scholarships  
- ⚡ API proxy keeps your Scorecard API key off the client  
- 🧩 Accessible UI designed for high-school students & families  

---

## 🛠 Tech Stack
- **Frontend:** React + Vite + TypeScript + Tailwind CSS  
- **Charts:** Recharts (donut visualization)  
- **Backend:** Node.js + Express (API proxy)  
- **Data Source:** U.S. Dept. of Education **College Scorecard API**

---

## 🧮 Estimation Model (Plain English)

> These are lightweight **heuristics for learning & comparison**, not official offers. Actual awards vary by institution and financial-aid policies.

**Variables**
- `N` = school’s **net price** (from Scorecard when available)  
- `I` = **household income** (user input)  
- `G_need` = **need-based grants** (by income tier)  
- `S_merit` = **merit-based scholarship** (by GPA tier)  
- `W` = **work-study** (flat assumption by income)  
- `L` = **estimated loans** (residual)  
- `C` = **expected student contribution** (fixed; e.g., $1,800)  
- `GPA` = 0.0–4.0 (user input)

**1) Need-Based Grants (by income)**
- `I ≤ $30k` → `$9,000`  
- `$30,001–$48k` → `$7,000`  
- `$48,001–$75k` → `$5,000`  
- `$75,001–$110k` → `$2,500`  
- `> $110k` → `$1,000`  
- Cap so that `G_need ≤ N`

**2) Merit-Based Scholarships (by GPA)**
- `GPA ≥ 3.8` → `+$1,500`  
- `3.5 ≤ GPA < 3.8` → `+$750`  
- `GPA < 3.5` → `+$0`  
- Cap so that `G_need + S_merit ≤ N`

**3) Work-Study**
- If `I ≤ $110k`: `$2,000`  
- Else: `$1,500`

**4) Loans & Out-of-Pocket**
- `L = max(0, N - G_need - S_merit - W - C)`  
- `OOP = max(0, N - G_need - S_merit - W - L)`

> The UI labels each bucket distinctly: **Need Grants**, **Merit Scholarship**, **Work-Study**, **Loans**, **Out-of-Pocket**.

---

## 📦 Repo Structure
Student_Financial_Aid/
├─ client/                  # React + Vite + TypeScript + Tailwind
│  ├─ src/
│  └─ package.json          # name: "student-financial-aid-client"
├─ server/                  # Node + Express API proxy
│  ├─ src/
│  └─ package.json          # name: "student-financial-aid-server"
├─ docs/
│  └─ Student_Financial_Aid_Presentation.pdf
├─ .env                     # DATAGOV_API_KEY=... (never commit)
└─ README.md


---

## ⚙️ Setup & Run

### 1) Prerequisites
- Node 18+  
- A **College Scorecard API key** from [data.gov](https://catalog.data.gov/)

### 2) Environment
Create a `.env` file (root or `server/` depending on your implementation):


### 3) Install & Start (two terminals)

**Server**
```bash
cd server
npm install
npm run dev

cd client
npm install
npm run dev

Client → http://localhost:5173

Server → http://localhost:5174

DATAGOV_API_KEY=YOUR_DATA_GOV_KEY
PORT=5174
VITE_API_BASE=/api
