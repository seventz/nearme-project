const supertest = require('supertest');
const app = require('../app');

describe('Main fetching test: ', function(){
    it('should return main categories', function(done){
        supertest(app).get('/list/category')
            .expect(["custom", "official"], done);
    });
    it('get activity detail with valid id, should return "content" and "member"', async function(done){
        let res = await supertest(app).get('/activity/detail?actl_id=2d5d6e00c48c20d9');
        
        expect(res.status).toEqual(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('content');
        expect(res.body.data.content).not.toBeUndefined();
        expect(res.body.data).toHaveProperty('member');
        done();
    });
    it('get activity detali with invalid id, should return empty "content" and "member"', async function(done){
        let res = await supertest(app).get('/activity/detail?actl_id=no_such_id');
        
        expect(res.status).toEqual(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('content');
        expect(res.body.data.content).toBeNull();
        expect(res.body.data).toHaveProperty('member');
        expect(res.body.data.member.length).toBe(0);
        done();
    });
})
describe('Get event data test: ', function(){
    // Assign global variable for later use
    let filters = {
        center: '205.041,121.541',
        dist: Math.random()*10,
        cat: '',
        owner: '',
        type: '',
        listing: 12,
        paging: 0
    }
    let entriesInFirstQuery = 0;
    it('get data from database if main filters changed:', async function(done){
        let mode = 'all';
        let queryArr = [];
        for(let name in filters){queryArr.push(`${name}=${filters[name]}`);}
        const res = await supertest(app).get(`/filter/${mode}?${queryArr.join('&')}`)

        expect(res.body.status).toEqual(200);
        expect(res.body.source).toBe('database');
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('info');
        expect(res.body.info.entries).toBeGreaterThanOrEqual(res.body.data.length);
        // Assign variables for the next comparison
        entriesInFirstQuery = res.body.info.entries;
        done();
    });
    it('get data from cache if main filters remain the same:', async function(done){
        let mode = 'all';
        let queryArr = [];
        // Changing filter properties that does not belong to the main filters
        filters.listing = 24;
        filters.paging = 1;

        for(let name in filters){queryArr.push(`${name}=${filters[name]}`);}
        const res = await supertest(app).get(`/filter/${mode}?${queryArr.join('&')}`)

        expect(res.body.status).toEqual(200);
        expect(res.body.source).toBe('cache');
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('info');
        expect(res.body.info.entries).toEqual(entriesInFirstQuery);
        done();
    });
})

describe('User authentication test: ', function(){
    it('succeeds with correct credentials', async function(done){
        let data = JSON.stringify({
            provider: 'native',
            email: 'ken@gmail.com',
            password: 'zxcvbn'
        });
        const res = await supertest(app)
            .post('/user/signin')
            .set('Accept', 'application/json')
            .set('Content-Type', 'application/json')
            .send(data)
        expect(res.body.status).toEqual(200)
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('preference');
        done();
    });
    it('fails with incorrect credentials', async function(done){
        let data = JSON.stringify({
            provider: 'native',
            email: 'notexisting@gmail.com',
            password: 'invalidpassword'
        });
        const res = await supertest(app)
            .post('/user/signin')
            .set('Accept', 'application/json')
            .set('Content-Type', 'application/json')
            .send(data)
        expect(res.body.status).toEqual(403)
        expect(res.body).toHaveProperty('error');
        done();
    });
})
  