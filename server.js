const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
// TRƯỚC: const PORT = 3000;
// SAU: Render sẽ cấp cổng ngẫu nhiên qua biến môi trường PORT
const PORT = process.env.PORT || 3000;
const CSV_FILE = '/tmp/danh_sach_acc.csv'; // Render không cho ghi file ở thư mục gốc, dùng /tmp

// --- NAME DATASET (Expanded) ---
const firstNamesRaw = `An\nAnh\nBinh\nChi\nCuong\nDung\nDuy\nGiang\nHai\nHa\nHieu\nHoa\nHung\nHuy\nKhoa\nKhanh\nLan\nLinh\nLong\nMai\nMinh\nMy\nNam\nNga\nNgan\nNgoc\nNhi\nNhung\nPhong\nPhuc\nPhuong\nQuan\nQuang\nQuynh\nSon\nTai\nTam\nThao\nThang\nThanh\nThinh\nThu\nThuy\nTien\nTrang\nTri\nTrinh\nTrung\nTu\nTuyet\nUyen\nVan\nViet\nVinh\nVy\nXuan\nYen\nDat\nDong\nDuc\nHanh\nHoai\nHong\nHuong\nKhang\nKien\nLoc\nLy\nManh\nMen\nNghia\nOanh\nPhat\nPhuong\nQuy\nSang\nTan\nThai\nThi\nTho\nThu\nThuan\nToan\nTruong\nTuan\nTung\nVy\nXuyen\nYen\nAnh\nBao\nCam\nDiep\nGioi\nHau\nKhoi\nLam\nPhong\nTin\nVuong\nBich\nBang\nCanh\nChien\nChinh\nDanh\nDi\nDieu\nDu\nDuoc\nGia\nGiao\nHiep\nHuân\nHy\nKha\nKhiêm\nKiệt\nLợi\nLuân\nLương\nNhân\nNhật\nNinh\nPhan\nPhi\nPhú\nQuý\nSỹ\nTâm\nTân\nTấn\nTùng\nTú\nTường\nVân\nVũ`;
const lastNamesRaw = `Nguyen Van\nTran Thi\nLe Van\nPham Thi\nHoang Van\nVu Van\nDang Van\nBui Thi\nDo Van\nHo Thi\nNgo Van\nDuong Van\nLy Van\nMai Van\nCao Van\nPhan Van\nTrinh Thi\nChu Thi\nTa Van\nQuach Thi\nNguyen Hoang\nTran Ngoc\nLe Minh\nPham Thu\nHoang Thi\nVu Thu\nDang Thi\nBui Thu\nDo Minh\nHo Van\nNgo Thi\nDuong Van\nLy Minh\nMai Thi\nCao Van\nPhan Minh\nTrinh Van\nChu Thi\nTa Van\nQuach Thi\nNguyen Dinh\nTran Manh\nLe Phuc\nPham Gia\nHoang Nhat\nVu Duc\nDang Bao\nBui Quang\nDo Tien\nHo Sy\nNgo Huu\nDuong Khanh\nLy Hoai\nMai Quoc\nCao Thanh\nPhan Trong\nTrinh Xuan\nChu Manh\nTa Dinh\nQuach Ngoc\nNguyen Khanh\nTran Hoang\nLe Ba\nPham Minh\nHoang Duc\nVu Kim\nDang Ngoc\nBui Thanh\nDo Hoai\nHo Duc\nNgo Ba\nDuong Minh\nLy Gia\nMai Thanh\nCao Duc\nPhan Nhat\nTrinh Kim\nChu Duc\nTa Minh\nQuach Anh\nNguyen Thanh\nTran Duc\nLe Huu\nPham Nhat\nHoang Bao\nVu Hoang\nDang Huu\nBui Nhat\nDo Kim\nHo Thanh\nNgo Minh\nDuong Bao\nLy Nhat\nMai Duc\nCao Minh\nPhan Hoang\nTrinh Bao\nChu Nhat\nTa Thanh\nQuach Minh`;

const processNames = (raw) => raw.split('\n').map(name => name.trim()).filter(name => name !== '');
const firstNames = processNames(firstNamesRaw);
const lastNames = processNames(lastNamesRaw);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/clear', (req, res) => {
    fs.writeFileSync(CSV_FILE, '\ufeffFirst Name,Last Name,Email,Link Inbox\n', 'utf8');
    res.json({ success: true });
});

app.get('/download', (req, res) => {
    if (fs.existsSync(CSV_FILE)) res.download(CSV_FILE);
    else res.status(404).send("File not found.");
});

app.get('/create', async (req, res) => {
    const API_KEY = 'k_dOxtJUlOIKS9RQ3ReUXU7pNfsnRa6IJ2pvIb';
    const email = `user_${Math.floor(Math.random() * 1000000)}@mailsac.com`;
    const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const inboxLink = `https://mailsac.com/inbox/${email}`;

    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: "new", 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--single-process' // Thêm cái này để tiết kiệm RAM trên Cloud
            ],
            // TRÊN RENDER CẦN ĐƯỜNG DẪN CHROME (Sẽ cài qua Build Command)
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null 
        });
        
        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'font', 'stylesheet'].includes(req.resourceType()) && req.url().includes('google')) {
                 req.abort();
            } else if (req.resourceType() === 'image') {
                 req.abort();
            } else {
                 req.continue();
            }
        });

        await page.goto('https://affiliates.2chat.co/login', { waitUntil: 'networkidle2', timeout: 60000 });

        await page.waitForSelector('input[name="email"]');
        await page.type('input[name="email"]', email);
        await page.keyboard.press('Enter');

        let otp = null;
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 4000));
            try {
                const mailRes = await axios.get(`https://mailsac.com/api/addresses/${email}/messages`, { 
                    headers: {'Mailsac-Key': API_KEY}, timeout: 5000 
                });
                if (mailRes.data.length > 0) {
                    const msg = await axios.get(`https://mailsac.com/api/text/${email}/${mailRes.data[0]._id}`, { 
                        headers: {'Mailsac-Key': API_KEY}, timeout: 5000
                    });
                    const match = msg.data.match(/\b\d{6}\b/);
                    if (match) { otp = match[0]; break; }
                }
            } catch (e) {}
            if (i === 8) await page.keyboard.press('Enter');
        }

        if (!otp) throw new Error("OTP Timeout");

        await page.waitForSelector('input[data-input-otp="true"]');
        await page.type('input[data-input-otp="true"]', otp);
        await page.keyboard.press('Enter');

        await page.waitForSelector('input[name="first_name"]', { timeout: 20000 });
        await page.type('input[name="first_name"]', fName);
        await page.type('input[name="last_name"]', lName);

        const dropdowns = await page.$$('button[role="combobox"]');
        if (dropdowns.length >= 2) {
            await dropdowns[1].click();
            await new Promise(r => setTimeout(r, 800));
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
        }
        
        await new Promise(r => setTimeout(r, 1000));
        const inputs = await page.$$('input');
        await inputs[inputs.length - 1].type(email);

        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Continue') && b.type === 'submit');
            if (btn) btn.click();
        });

        await new Promise(r => setTimeout(r, 4000));
        fs.appendFileSync(CSV_FILE, `"${fName}","${lName}","${email}","${inboxLink}"\n`, 'utf8');
        res.json({ success: true, fName, lName, email, otp: inboxLink });

    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    } finally {
        if (browser) await browser.close();
    }
});

app.listen(PORT, () => console.log(`Active on Port: ${PORT}`));