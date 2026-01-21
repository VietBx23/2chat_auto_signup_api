const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ Render chỉ ghi tạm → dùng /tmp
const CSV_FILE = path.join('/tmp', 'danh_sach_acc.csv');

// ================== DANH SÁCH TÊN ==================
const firstNamesRaw = `An
Anh
Binh
Chi
Cuong
Dung
Duy
Giang
Hai
Ha
Hieu
Hoa
Hung
Huy
Khoa
Khanh
Lan
Linh
Long
Mai
Minh
My
Nam
Nga
Ngan
Ngoc
Nhi
Nhung
Phong
Phuc
Phuong
Quan
Quang
Quynh
Son
Tai
Tam
Thao
Thang
Thanh
Thinh
Thu
Thuy
Tien
Trang
Tri
Trinh
Trung
Tu
Tuyet
Uyen
Van
Viet
Vinh
Vy
Xuan
Yen`;

const lastNamesRaw = `Nguyen Van
Tran Thi
Le Van
Pham Thi
Hoang Van
Vu Van
Dang Van
Bui Thi
Do Van
Ho Thi
Ngo Van
Duong Van
Ly Van
Mai Van
Cao Van
Phan Van
Trinh Thi
Chu Thi
Ta Van
Quach Thi`;

const processNames = (raw) =>
    raw.split('\n').map(n => n.trim()).filter(Boolean);

const firstNames = processNames(firstNamesRaw);
const lastNames = processNames(lastNamesRaw);

// ================== ROUTES ==================
app.get('/', (req, res) => {
    res.send('Server OK');
});

app.get('/clear', (req, res) => {
    fs.writeFileSync(CSV_FILE, '\ufeffFirst Name,Last Name,Email,OTP\n', 'utf8');
    res.json({ success: true });
});

app.get('/download', (req, res) => {
    if (fs.existsSync(CSV_FILE)) return res.download(CSV_FILE);
    res.status(404).send('Chưa có file');
});

app.get('/create', async (req, res) => {
    const API_KEY = process.env.MAILSAC_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ error: 'Thiếu MAILSAC_API_KEY' });
    }

    const email = `user_${Date.now()}@mailsac.com`;
    const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lName = lastNames[Math.floor(Math.random() * lastNames.length)];

    console.log(`[START] ${email}`);

    let browser;
    try {
        // ================== LAUNCH CHROME (RENDER) ==================
        browser = await puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            defaultViewport: chromium.defaultViewport,
            headless: chromium.headless,
        });

        const page = await browser.newPage();

        // Chặn ảnh cho nhanh
        await page.setRequestInterception(true);
        page.on('request', req => {
            if (req.resourceType() === 'image') req.abort();
            else req.continue();
        });

        await page.goto('https://affiliates.2chat.co/login', {
            waitUntil: 'networkidle2',
            timeout: 120000,
        });

        await page.waitForSelector('input[name="email"]');
        await page.type('input[name="email"]', email);
        await page.keyboard.press('Enter');

        // ================== LẤY OTP ==================
        let otp = null;
        for (let i = 0; i < 25; i++) {
            await new Promise(r => setTimeout(r, 3000));

            try {
                const list = await axios.get(
                    `https://mailsac.com/api/addresses/${email}/messages`,
                    { headers: { 'Mailsac-Key': API_KEY } }
                );

                if (list.data.length) {
                    const msg = await axios.get(
                        `https://mailsac.com/api/text/${email}/${list.data[0]._id}`,
                        { headers: { 'Mailsac-Key': API_KEY } }
                    );
                    const match = msg.data.match(/\b\d{6}\b/);
                    if (match) {
                        otp = match[0];
                        break;
                    }
                }
            } catch {}

            if (i === 10) await page.keyboard.press('Enter');
        }

        if (!otp) throw new Error('Không nhận được OTP');

        await page.waitForSelector('input[data-input-otp="true"]');
        await page.type('input[data-input-otp="true"]', otp);
        await page.keyboard.press('Enter');

        await page.waitForSelector('input[name="first_name"]');
        await page.type('input[name="first_name"]', fName);
        await page.type('input[name="last_name"]', lName);

        const dropdowns = await page.$$('button[role="combobox"]');
        if (dropdowns[1]) {
            await dropdowns[1].click();
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
        }

        const inputs = await page.$$('input');
        await inputs[inputs.length - 1].type(email);

        await page.evaluate(() => {
            [...document.querySelectorAll('button')]
                .find(b => b.textContent.includes('Continue'))?.click();
        });

        await new Promise(r => setTimeout(r, 5000));

        fs.appendFileSync(
            CSV_FILE,
            `"${fName}","${lName}","${email}","${otp}"\n`
        );

        console.log(`[DONE] ${email} | OTP ${otp}`);
        res.json({ success: true, email, otp });

    } catch (err) {
        console.error('[ERROR]', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        if (browser) await browser.close();
    }
});

app.listen(PORT, () =>
    console.log(`Server running on port ${PORT}`)
);
