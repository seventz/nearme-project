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
    BUCKET_NAME: 'seventz002',
    S3_BUCKET: 'https://seventz002.s3.amazonaws.com/',
    CAT: ['custom', 'official']
}

// -- Crawler settings -- //
// (Meetup: radius in mile, page = counts in one page)
const crawler = {
    update:{
        DAY_INTEVAL: 1
    },
    params:{
        meetup:{
            lat: 25.04,
            lon: 121.54,
            radius: 10,
            page: 55
        }
    }
}


// Authorization settings
const auth = {
    googlemap:{
        APIKEY: process.env.GOOGLE_MAP_API_KEY
    },
    aws:{
        ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
        SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY
    },
    meetup:{
        CLIENT_ID: process.env.MEETUP_CLIENT_ID,
        CLIENT_SECRET: process.env.MEETUP_CLIENT_SECRET,
        access_token: process.env.MEETUP_ACESS_TOKEN,
        refresh_token: process.env.MEETUP_REFRESH_TOKEN
    },
    mysql:{
        CONNLIMIT: process.env.MYSQL_CONNLIMIT,
        HOST: process.env.MYSQL_HOST,
        USER: process.env.MYSQL_USER,
        PASSWORD: process.env.MYSQL_PASSWORD,
        DATABASE: process.env.MYSQL_DB
    },
    redis:{
        HOST: process.env.REDIS_HOST,
        PORT: process.env.REDIS_PORT
    },
    admin: {
        PW_SECRET: process.env.PW_SECRET,
        PORT: process.env.PORT
    }
}


module.exports = {
    algo: algo,
    admin: admin,
    crawler: crawler,
    auth: auth
}