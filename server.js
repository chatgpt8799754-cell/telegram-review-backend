import express from 'express';

import cors from 'cors';

import axios from 'axios';

import admin from 'firebase-admin';

import fs from 'fs';

const app = express();

app.use(cors());

app.use(express.json());

/* =========================================
   FIREBASE ADMIN
========================================= */

const serviceAccount =
JSON.parse(
    fs.readFileSync('./firebase-service-account.json')
);

admin.initializeApp({
    credential:
    admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/* =========================================
   ENV
========================================= */

const BOT_TOKEN =
process.env.BOT_TOKEN;

const CHAT_ID =
process.env.CHAT_ID;

/* =========================================
   SEND REVIEW
========================================= */

app.post('/send-review', async (req, res) => {

    try {

        const {
            reviewId,
            name,
            country,
            review,
            rating
        } = req.body;

        const text = `

⭐ NEW REVIEW

👤 Name: ${name}

🌍 Country: ${country}

⭐ Rating: ${rating}/5

💬 Review:
${review}

🆔 ID:
${reviewId}

`;

        await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
            {
                chat_id: CHAT_ID,

                text,

                reply_markup: {

                    inline_keyboard: [
                        [
                            {
                                text: "✅ Approve",
                                callback_data:
                                `approve_${reviewId}`
                            },

                            {
                                text: "❌ Reject",
                                callback_data:
                                `reject_${reviewId}`
                            }
                        ]
                    ]
                }
            }
        );

        res.json({
            success: true
        });

    } catch(err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });
    }
});


/* =========================================
   TELEGRAM WEBHOOK
========================================= */

app.post('/webhook', async (req, res) => {

    try {

        const body = req.body;

        /* APPROVE / REJECT */

        if (body.callback_query) {

            const data =
            body.callback_query.data;

            const [action, reviewId] =
            data.split('_');

            if (action === 'approve') {

                const pendingDoc =
                await db
                .collection('pendingReviews')
                .doc(reviewId)
                .get();

                if (!pendingDoc.exists) {

                    return res.sendStatus(200);
                }

                const reviewData =
                pendingDoc.data();

                await db
                .collection('reviews')
                .doc(reviewId)
                .set({
                    ...reviewData,
                    approved: true
                });

                await db
                .collection('pendingReviews')
                .doc(reviewId)
                .delete();

                await axios.post(
                    `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`,
                    {
                        callback_query_id:
                        body.callback_query.id,

                        text:
                        "Review Approved ✅"
                    }
                );
            }

            if (action === 'reject') {

                await db
                .collection('pendingReviews')
                .doc(reviewId)
                .delete();

                await axios.post(
                    `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`,
                    {
                        callback_query_id:
                        body.callback_query.id,

                        text:
                        "Review Rejected ❌"
                    }
                );
            }
        }

        /* ADMIN REPLY */

        if (
            body.message &&
            body.message.text &&
            body.message.text.startsWith('/reply')
        ) {

            const parts =
            body.message.text.split(' ');

            const reviewId =
            parts[1];

            const reply =
            parts.slice(2).join(' ');

            await db
            .collection('reviews')
            .doc(reviewId)
            .update({
                reply
            });

            await axios.post(
                `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
                {
                    chat_id: CHAT_ID,

                    text:
                    `Reply Added ✅`
                }
            );
        }

        res.sendStatus(200);

    } catch(err) {

        console.error(err);

        res.sendStatus(500);
    }
});


/* =========================================
   ROOT
========================================= */

app.get('/', (req, res) => {

    res.send('Telegram Review Backend Running');
});


/* =========================================
   PORT
========================================= */

const PORT =
process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(
        `Server Running On ${PORT}`
    );
});