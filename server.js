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
        
        document.addEventListener("DOMContentLoaded", function() {
            applySmartGrouping();
            renderMathInElement(document.body, {
                delimiters: [
                    {left: "$$", right: "$$", display: true},
                    {left: "$", right: "$", display: false},
                    {left: "\\\\(", right: "\\\\)", display: false},
                    {left: "\\\\[", right: "\\\\]", display: true}
                ],
                throwOnError: false
            });
        });
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
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process' // এটি রেন্ডারের লিমিটেড র‍্যামে ক্র্যাশ হওয়া আটকাবে
        ]
    });
}
async function calculateContentPages(browser, content) {
    const page = await browser.newPage();
    const html = `<!DOCTYPE html><html>${htmlHeaderBlock}<body><div class="article-content">${content}</div></body></html>`;
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const tempBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: pdfMargin });
    await page.close();
    const count = tempBuffer.toString().split('/Type /Page').length - 1;
    return count || 1;
}

// এন্ডপয়েন্ট ১: সিঙ্গেল আর্টিকেল পিডিএফ
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
        ${htmlHeaderBlock}
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

        await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: '<div style="width: 100%; text-align: center; font-size: 10px; font-family: sans-serif; color: #777;"><span class="pageNumber"></span></div>',
            margin: pdfMargin
        });

        res.set({ 'Content-Type': 'application/pdf', 'Content-Length': pdfBuffer.length, 'Content-Disposition': `inline; filename="${encodeURIComponent(title)}.pdf"` });
        res.send(pdfBuffer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (browser) await browser.close();
    }
});

// এন্ডপয়েন্ট ২: সম্পূর্ণ সিরিজ বুক পিডিএফ
app.post('/api/v1/pdf/generate-series', async (req, res) => {
    let browser = null;
    try {
        const { seriesName, articles } = req.body;
        if (!seriesName || !articles || !Array.isArray(articles) || articles.length === 0) {
            return res.status(400).json({ error: 'Invalid payload setup' });
        }

        browser = await launchBrowser();
        let currentPagePointer = 2;
        const computedArticles = [];

        for (const art of articles) {
            const chapterCoverPage = currentPagePointer + 1;
            currentPagePointer += 1;
            
            const contentPages = await calculateContentPages(browser, art.content);
            computedArticles.push({ ...art, pageNum: chapterCoverPage });
            currentPagePointer += contentPages;
        }

        let htmlStr = `
        <!DOCTYPE html>
        <html lang="bn">
        ${htmlHeaderBlock}
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

        const page = await browser.newPage();
        await page.setContent(htmlStr, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: '<div style="width: 100%; text-align: center; font-size: 10px; font-family: sans-serif; color: #777;"><span class="pageNumber"></span></div>',
            margin: pdfMargin
        });

        res.set({ 'Content-Type': 'application/pdf', 'Content-Length': pdfBuffer.length, 'Content-Disposition': `inline; filename="${encodeURIComponent(seriesName)}_Series.pdf"` });
        res.send(pdfBuffer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (browser) await browser.close();
    }
});

app.listen(port, () => {
    console.log(`Production PDF API running on port ${port}`);
});
