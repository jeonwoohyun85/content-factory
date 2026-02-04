// SEO 관련 함수 (robots.txt, sitemap.xml)

const { fetchWithTimeout } = require('./utils/http-utils.js');
const { parseCSV } = require('./utils/csv-parser.js');
const { normalizeClient } = require('./utils/normalize.js');

function generateRobotsTxt() {

    return `User-agent: *

Allow: /



Sitemap: https://make-page.com/sitemap.xml`;

}

async function handleSitemap(env) {

    try {

        // Google Sheets에서 활성 거래처 조회

        const SHEET_URL = env.GOOGLE_SHEETS_CSV_URL || 'https://docs.google.com/spreadsheets/d/1KrzLFi8Wt9GTGT97gcMoXnbZ3OJ04NsP4lncJyIdyhU/export?format=csv&gid=0';

        const response = await fetchWithTimeout(SHEET_URL, {}, 10000);

        const csvText = await response.text();

        const clients = parseCSV(csvText).map(normalizeClient);



        const activeClients = clients.filter(client => client.subscription === '활성');



        let urls = [];



        // KST 날짜 계산

        const getKstDate = () => {

            const utcDate = new Date();

            const kstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));

            return kstDate.toISOString().split('T')[0];

        };



        // 거래처 메인 페이지만 포함

        activeClients.forEach(client => {
            // subdomain 정규화 (.make-page.com 제거)
            const normalizedSubdomain = client.subdomain.replace('.make-page.com', '').replace('/', '');

            urls.push({

                loc: `https://${normalizedSubdomain}.make-page.com/`,

                lastmod: getKstDate(),

                changefreq: 'daily',

                priority: '0.9'

            });

        });



        // XML 생성

        const xml = `<?xml version="1.0" encoding="UTF-8"?>

<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${urls.map(url => `  <url>

    <loc>${url.loc}</loc>

    <lastmod>${url.lastmod}</lastmod>

    <changefreq>${url.changefreq}</changefreq>

    <priority>${url.priority}</priority>

  </url>`).join('\n')}

</urlset>`;



        return new Response(xml, {

            headers: {

                'Content-Type': 'application/xml; charset=utf-8',

                'Cache-Control': 'public, max-age=3600'

            }

        });



    } catch (error) {

        console.error('Sitemap generation error:', error);

        return new Response('Error generating sitemap', { status: 500 });

    }

}

module.exports = { generateRobotsTxt, handleSitemap };
