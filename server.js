import express from 'express';
import cors from 'cors';
import axios from 'axios';
import admin from 'firebase-admin';
import fs from 'fs';

const app = express();

app.use(cors());
app.use(express.json());



/* FIREBASE */

const serviceAccount =
JSON.parse(
fs.readFileSync(
'./firebase-service-account.json',
'utf8'
)
);

admin.initializeApp({
credential:
admin.credential.cert(
serviceAccount
)
});

const db =
admin.firestore();



/* ENV */

const BOT_TOKEN =
process.env.BOT_TOKEN;

const CHAT_ID =
process.env.CHAT_ID;



/* ROOT */

app.get('/', (req,res)=>{

res.send(
'Telegram Review Backend Running'
);

});



/* SEND REVIEW */

app.post(
'/send-review',
async(req,res)=>{

try{

const {
reviewId,
name,
country,
review,
rating
}
=
req.body;

await axios.post(
`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
{

chat_id:
CHAT_ID,

text:

`⭐ NEW REVIEW

👤 ${name}

🌍 ${country}

⭐ ${rating}/5

💬 ${review}

🆔 ${reviewId}`,

reply_markup:{

inline_keyboard:[

[

{

text:
'✅ Approve',

callback_data:
`approve_${reviewId}`

},

{

text:
'❌ Reject',

callback_data:
`reject_${reviewId}`

}

]

]

}

}
);

res.json({
success:true
});

}

catch(err){

console.log(err);

res
.status(500)
.json({
error:
err.message
});

}

}
);



/* WEBHOOK */

app.post(
'/webhook',
async(req,res)=>{

try{

const body =
req.body;



/* APPROVE */

if(
body.callback_query
){

const data =
body.callback_query.data;

const [
action,
reviewId
]
=
data.split('_');



if(
action==='approve'
){

const pending =

await db
.collection(
'pendingReviews'
)
.doc(
reviewId
)
.get();


if(
!pending.exists
){

await axios.post(

`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`,

{

callback_query_id:
body.callback_query.id,

text:
'Review Not Found'

}

);

return res.sendStatus(
200
);

}


await db
.collection(
'reviews'
)
.doc(
reviewId
)
.set({

...pending.data(),

approved:
true

});


await db
.collection(
'pendingReviews'
)
.doc(
reviewId
)
.delete();



await axios.post(

`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`,

{

callback_query_id:
body.callback_query.id,

text:
'Approved ✅'

}

);



try{

await axios.post(

`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`,

{

chat_id:
body.callback_query.message.chat.id,

message_id:
body.callback_query.message.message_id,

reply_markup:{
inline_keyboard:[]
}

}

);

}
catch(e){

console.log(
'button remove skip'
);

}

}



/* REJECT */

if(
action==='reject'
){

await db
.collection(
'pendingReviews'
)
.doc(
reviewId
)
.delete();



await axios.post(

`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`,

{

callback_query_id:
body.callback_query.id,

text:
'Rejected ❌'

}

);



try{

await axios.post(

`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`,

{

chat_id:
body.callback_query.message.chat.id,

message_id:
body.callback_query.message.message_id,

reply_markup:{
inline_keyboard:[]
}

}

);

}
catch(e){

console.log(
'reject remove skip'
);

}

}

}



/* ADMIN REPLY */

if(

body.message &&

body.message.text &&

body.message.text.startsWith(
'/reply'
)

){

const parts =

body.message.text
.split(' ');

const reviewId =
parts[1];

const reply =

parts
.slice(2)
.join(' ');



await db
.collection(
'reviews'
)
.doc(
reviewId
)
.update({

reply

});



await axios.post(

`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,

{

chat_id:
CHAT_ID,

text:
'Reply Added ✅'

}

);

}



res.sendStatus(
200
);

}

catch(err){

console.log(
err
);

res.sendStatus(
500
);

}

}
);



/* PORT */

const PORT =

process.env.PORT
||
3000;

app.listen(
PORT,
()=>{

console.log(
`Running ${PORT}`
);

}
);
