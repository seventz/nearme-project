const dotenv = require('dotenv');
dotenv.config();
// -- Algorithm related -- //
const algo = {
    LAT_TO_M_PER_DEG: 185300,
    LNG_TO_M_PER_DEG: 167950
}

// -- Admin settings -- //
const admin = {
    TOKEN_EXPIRED_IN_SEC: 3000,
    PAGE_COUNT: 8,
    SERVER: 'https://seventz.cc',
    S3_BUCKET: 'https://seventz002.s3.amazonaws.com/',
    CAT: ['custom', 'official']
}

// -- Crawler settings -- //
const crawler = {
    update:{
        DAY_INTEVAL: 1
    },
    UTC_OFFSET_IN_MS: -28800000
}

// Parameters (Meetup: radius in mile, page = counts in one page)
const params = {
    meetup:{
        lat: 25.04,
        lon: 121.54,
        radius: 10,
        page: 100
    }
}

// Authorization settings
const auth = {
    googlemap:{
        apikey: process.env.GOOGLE_MAP_API_KEY
    },
    aws:{
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
    meetup:{
        client_id: process.env.MEETUP_CLIENT_ID,
        client_secret: process.env.MEETUP_CLIENT_SECRET,
        access_token: process.env.MEETUP_ACESS_TOKEN,
        refresh_token: process.env.MEETUP_REFRESH_TOKEN
    },
    mysql:{
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DB
    },
    admin: {
        pwsecret: process.env.PW_SECRET,
        port: process.env.PORT
    }
}


module.exports = {
    algo: algo,
    admin: admin,
    crawler: crawler,
    params: params,
    auth: auth
}