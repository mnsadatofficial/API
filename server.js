import express from 'express';
import puppeteer from 'puppeteer';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

const pdfMargin = { top: '40px', right: '40px', bottom: '60px', left: '40px' };

const htmlHeaderBlock = `
<head>
    <meta charset="UTF-8">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap');
        body { font-family: 'Outfit', 'Noto Sans Bengali', sans-serif; color: #000000; background: #ffffff; margin: 0; padding: 0; line-height: 1.8; }
        .page-break { page-break-before: always; break-before: page; }
        
        img, figure, pre, blockquote, li, table, .block-math, .katex-display { 
            page-break-inside: avoid !important; 
            break-inside: avoid !important; 
        }
        
        img { 
            max-width: 100% !important; 
            max-height: 420px !important; 
            display: block !important; 
            margin: 15px auto !important; 
            object-fit: contain !important; 
        }
        
        .heading-group {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }

        h1, h2, h3, h4, h5, h6 { 
            page-break-after: avoid !important; 
            break-after: avoid !important; 
            margin-top: 1.2em; 
            margin-bottom: 0.4em;
        }
        
        .cover-page { height: 100vh; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; padding: 80px 40px; box-sizing: border-box; }
        .cover-main { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; }
        .title-main { font-size: 48px; font-weight: 900; color: #000000; letter-spacing: -1.5px; line-height: 1.2; margin-bottom: 15px; }
        .cover-footer { margin-top: auto; display: flex; flex-direction: column; align-items: center; }
        .pub-text { font-size: 15px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #000000; }
        
        .index-page { padding: 40px 10px; }
        .index-title { font-size: 36px; font-weight: 900; border-bottom: 3px solid #000000; padding-bottom: 10px; margin-bottom: 40px; }
        .index-list { list-style: none; padding: 0; font-size: 18px; }
        .index-list li { margin-bottom: 20px; padding-bottom: 8px; border-bottom: 1px dashed #cccccc; display: flex; justify-content: space-between; align-items: flex-end; }
        .index-page-num { font-weight: 700; font-size: 18px; padding-left: 10px; background: #ffffff; }
        .index-text { background: #ffffff; padding-right: 5px; font-weight: 500; }
        
        .article-content { padding: 40px 10px; font-size: 1.15rem; color: #000000; }
        .article-content h1, .article-content h2, .article-content h3 { font-weight: 700; border-bottom: 1px solid #eeeeee; padding-bottom: 6px; }
        blockquote { border-left: 4px solid #000000; padding-left: 16px; margin: 16px 0; font-style: italic; background: #f9f9f9; padding-top: 10px; padding-bottom: 10px; }
        pre { background: #f5f5f5; color: #000000; padding: 16px; border-radius: 6px; overflow-x: auto; font-family: monospace; border: 1px solid #e0e0e0; }
        .block-math { display: block; text-align: center; margin: 20px 0; background: #f9f9f9; padding: 12px; border-radius: 6px; border: 1px solid #e0e0e0; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>
    
    <script>
        function applySmartGrouping() {
            document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
                if (heading.parentElement.classList.contains('heading-group')) return;
                let next = heading.nextElementSibling;
                if (next && (next.tagName === 'P' || next.tagName === 'IMG' || next.tagName === 'FIGURE' || next.classList.contains('block-math') || next.tagName === 'PRE')) {
                    let wrapper = document.createElement('div');
                    wrapper.className = 'heading-group';
                    heading.parentNode.insertBefore(wrapper, heading);
                    wrapper.appendChild(heading);
                    wrapper.appendChild(next);
                }
            });
        }
        
        function initPdfAssets() {
            applySmartGrouping();
            if (typeof renderMathInElement === "function") {
                renderMathInElement(document.body, {
                    delimiters: [
                        {left: "$$", right: "$$", display: true},
                        {left: "$", right: "$", display: false},
                        {left: "\\\\(", right: "\\\\)", display: false},
                        {left: "\\\\[", right: "\\\\]", display: true}
                    ],
                    throwOnError: false
                });
            }
        }

        window.initPdfAssets = initPdfAssets;

        if (document.readyState === 'loading') {
            document.addEventListener("DOMContentLoaded", initPdfAssets);
        } else {
            initPdfAssets();
        }
    </script>
</head>
`;

function launchBrowser() {
    return puppeteer.launch({
        headless: 'new',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            '--disable-extensions'
        ]
    });
}

// -------------------------------------------------------------
// ফিক্স: ইমেজ লোড হওয়া পর্যন্ত ওয়েট করার লজিক যুক্ত করা হলো
// -------------------------------------------------------------
async function calculateContentPages(page, content) {
    try {
        await page.evaluate(async (htmlContent) => {
            const div = document.getElementById('content');
            div.innerHTML = htmlContent;
            if (typeof window.initPdfAssets === 'function') {
                window.initPdfAssets();
            }
            
            // ইমেজের হাইট মিসম্যাচ এড়াতে ইমেজ লোড হওয়া পর্যন্ত অপেক্ষা
            const images = Array.from(document.querySelectorAll('img'));
            await Promise.all(images.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = resolve; // এরর হলেও কাউন্টিং যেন না থামে
                });
            }));
            
            await document.fonts.ready;
        }, content);

        // DOM আপডেটের জন্য ছোট্ট একটা বাফার
        await new Promise(resolve => setTimeout(resolve, 150));

        const tempBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: pdfMargin });
        const pdfBinary = tempBuffer.toString('binary');
        
        let count = 0;
        const matches = pdfBinary.match(/\/Type\s*\/Page\b/g);
        count = matches ? matches.length : 0;
        
        if (count === 0) {
            const countMatch = pdfBinary.match(/\/Count\s+(\d+)/);
            if (countMatch) count = parseInt(countMatch[1], 10);
        }
        
        return count || 1;
    } catch (err) {
        console.error("Error calculating pages:", err);
        return 1;
    }
}

// এন্ডপয়েন্ট ১: একক আর্টিকেল পিডিএফ জেনারেশন
app.post('/api/v1/pdf/generate-article', async (req, res) => {
    let browser = null;
    try {
        const { title, content } = req.body;
        if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });

        browser = await launchBrowser();
        const page = await browser.newPage();
        
        const finalHtml = `
        <!DOCTYPE html>
        <html lang="bn">
        ${htmlHeaderBlock.replace('<head>', `<head>\n    <title>${title}</title>`)}
        <body>
            <div class="cover-page">
                <div class="cover-main">
                    <div class="title-main">${title}</div>
                </div>
                <div class="cover-footer">
                    <div class="pub-text">AKASHIORA PUBLICATION</div>
                </div>
            </div>
            <div class="page-break"></div>
            <div class="article-content">${content}</div>
        </body>
        </html>`;

        await page.setContent(finalHtml, { waitUntil: 'load', timeout: 30000 });
        await page.evaluate(async () => { await document.fonts.ready; });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: '<div style="width: 100%; text-align: center; font-size: 10px; font-family: sans-serif; color: #777;"><span class="pageNumber"></span></div>',
            margin: pdfMargin,
            timeout: 30000
        });

        const base64Pdf = Buffer.from(pdfBuffer).toString('base64');
        res.status(200).json({ pdf: base64Pdf });

    } catch (error) {
        console.error("Single PDF Error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    } finally {
        if (browser) await browser.close();
    }
});

// এন্ডপয়েন্ট ২: সম্পূর্ণ সিরিজ বুক পিডিএফ জেনারেশন (অপ্টিমাইজড)
app.post('/api/v1/pdf/generate-series', async (req, res) => {
    let browser = null;
    try {
        const { seriesName, articles } = req.body;
        if (!seriesName || !articles || !Array.isArray(articles) || articles.length === 0) {
            return res.status(400).json({ error: 'Invalid payload setup' });
        }

        browser = await launchBrowser();
        
        const counterPage = await browser.newPage();
        const counterHtml = `<!DOCTYPE html><html>${htmlHeaderBlock.replace('<head>', `<head>\n    <title>${seriesName} - Counter</title>`)}<body><div id="content" class="article-content"></div></body></html>`;
        await counterPage.setContent(counterHtml, { waitUntil: 'load', timeout: 30000 });
        await counterPage.evaluate(async () => { await document.fonts.ready; });

        let currentPagePointer = 2; // কভার = ১, ইনডেক্স = ২
        const computedArticles = [];

        // ২. রিয়েলটাইম ইমেজ-অ্যাওয়ার পেজ কাউন্টিং
        for (const art of articles) {
            const chapterCoverPage = currentPagePointer + 1;
            currentPagePointer += 1; 
            
            const contentPages = await calculateContentPages(counterPage, art.content);
            computedArticles.push({ ...art, pageNum: chapterCoverPage });
            currentPagePointer += contentPages;
        }
        
        await counterPage.close(); 

        // ৩. ইনডেক্স ও মূল কনটেন্ট সহ ফাইনাল HTML তৈরি
        let htmlStr = `
        <!DOCTYPE html>
        <html lang="bn">
        ${htmlHeaderBlock.replace('<head>', `<head>\n    <title>${seriesName}</title>`)}
        <body>
            <div class="cover-page">
                <div class="cover-main">
                    <div class="title-main" style="font-size: 55px;">${seriesName}</div>
                </div>
                <div class="cover-footer">
                    <div class="pub-text" style="font-size: 16px;">AKASHIORA PUBLICATION</div>
                </div>
            </div>
            <div class="page-break"></div>

            <div class="index-page">
                <div class="index-title">INDEX</div>
                <ul class="index-list">`;

        computedArticles.forEach((art, idx) => {
            htmlStr += `
                <li>
                    <span class="index-text"><strong>${idx + 1}.</strong> ${art.title}</span>
                    <span class="index-page-num">${art.pageNum}</span>
                </li>`;
        });

        htmlStr += `
                </ul>
            </div>
            <div class="page-break"></div>`;

        computedArticles.forEach((art, idx) => {
            htmlStr += `
                <div class="cover-page">
                    <div class="cover-main">
                        <div class="title-main" style="font-size: 40px;">${art.title}</div>
                    </div>
                    <div class="cover-footer">
                        <div class="pub-text">AKASHIORA</div>
                    </div>
                </div>
                <div class="page-break"></div>
                <div class="article-content">${art.content}</div>`;
            
            if (idx < computedArticles.length - 1) {
                htmlStr += `<div class="page-break"></div>`;
            }
        });

        htmlStr += `</body></html>`;

        // ৪. ফাইনাল কম্পাইল্ড বুক পিডিএফ জেনারেট করা
        const finalPage = await browser.newPage();
        await finalPage.setContent(htmlStr, { waitUntil: 'networkidle0', timeout: 90000 });
        await finalPage.evaluate(async () => { await document.fonts.ready; });
        
        const pdfBuffer = await finalPage.pdf({
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: '<div style="width: 100%; text-align: center; font-size: 10px; font-family: sans-serif; color: #777;"><span class="pageNumber"></span></div>',
            margin: pdfMargin,
            timeout: 90000
        });

        const base64Pdf = Buffer.from(pdfBuffer).toString('base64');
        res.status(200).json({ pdf: base64Pdf });

    } catch (error) {
        console.error("Series PDF Error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    } finally {
        if (browser) await browser.close();
    }
});

app.listen(port, () => {
    console.log(`Production PDF API running on port ${port}`);
});
