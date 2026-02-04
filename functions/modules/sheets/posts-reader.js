// Google Sheets 포스팅 조회

const { normalizeSubdomain } = require('../utils/normalize.js');
const { getGoogleAccessTokenForPosting } = require('../auth.js');

async function getPostsFromArchive(subdomain, env) {

  try {

    // Step 1: 토큰 발급

    let accessToken;

    try {

      accessToken = await getGoogleAccessTokenForPosting(env);

    } catch (tokenError) {

      return { posts: [], error: `Token error: ${tokenError.message}` };

    }



    const latestSheetName = env.LATEST_POSTING_SHEET_NAME || '최신_포스팅';

    const allPosts = [];



    // Step 2: 최신_포스팅 시트 읽기

    const latestResponse = await fetch(

      `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent(latestSheetName)}!A:Z`,

      { headers: { Authorization: `Bearer ${accessToken}` } }

    );



    if (latestResponse.ok) {

      const latestData = await latestResponse.json();

      const latestRows = latestData.values || [];



      if (latestRows.length >= 2) {

        const headers = latestRows[0];

        const domainIndex = headers.indexOf('도메인');

        const businessNameIndex = headers.indexOf('상호명');

        const titleIndex = headers.indexOf('제목');

        const urlIndex = headers.indexOf('URL');

        const createdAtIndex = headers.indexOf('생성일시');

        const languageIndex = headers.indexOf('언어');

        const industryIndex = headers.indexOf('업종');

        const bodyIndex = headers.indexOf('본문');

        const imagesIndex = headers.indexOf('이미지');



        if (domainIndex !== -1) {

          for (let i = 1; i < latestRows.length; i++) {

            const row = latestRows[i];

            const domain = row[domainIndex] || '';

            const normalizedDomain = normalizeSubdomain(domain);



            if (normalizedDomain === subdomain) {

              allPosts.push({

                subdomain: domain,

                business_name: businessNameIndex !== -1 ? (row[businessNameIndex] || '') : '',

                title: titleIndex !== -1 ? (row[titleIndex] || '') : '',

                url: urlIndex !== -1 ? (row[urlIndex] || '') : '',

                created_at: createdAtIndex !== -1 ? (row[createdAtIndex] || '') : '',

                language: languageIndex !== -1 ? (row[languageIndex] || '') : '',

                industry: industryIndex !== -1 ? (row[industryIndex] || '') : '',

                body: bodyIndex !== -1 ? (row[bodyIndex] || '') : '',

                images: imagesIndex !== -1 ? (row[imagesIndex] || '') : ''

              });

            }

          }

        }

      }

    }



    // created_at 기준 내림차순 정렬 (최신순)

    allPosts.sort((a, b) => {

      const dateA = new Date(a.created_at);

      const dateB = new Date(b.created_at);

      return dateB - dateA;

    });



    return { posts: allPosts, error: null };

  } catch (error) {

    console.error('Error fetching posts from sheets:', error);

    return { posts: [], error: `${error.message} (${error.stack?.substring(0, 100) || 'no stack'})` };

  }

}

module.exports = { getPostsFromArchive };
