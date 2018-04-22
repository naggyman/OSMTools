const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const request = require('request');
const secrets = require('./api/secrets')

const api = require('./api/api');
const fbapi = require('./api/fb');
const memberFrontend = require('./frontend/members');
const accountFrontend = require('./frontend/account');

const session = require('express-session');
const RedisStore = require('connect-redis')(session);

app.set('view engine', 'pug');
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(session({store: new RedisStore(client = api.redisClient, db=1), secret: secrets.sessionSecret, resave: true, saveUninitialized: true }))

const urlencodedParser = bodyParser.urlencoded({ extended: false })

/*
 * ACCOUNT MANAGEMENT STUFF
 */
app.get('/dashboard/', (req, res) => checkDecorator(req, res, accountFrontend.dashboardView, true, true));
app.get('/login/', (req, res) => accountFrontend.loginView(req, res));
app.get('/logout/', (req, res) => checkDecorator(req, res, accountFrontend.logout, true, false));
app.get('/section-selection/', (req, res) => checkDecorator(req, res, accountFrontend.section_selection, true, false));

app.get('/fb/', (req, res) => checkDecorator(req, res, fbapi.fbprofile, true, true));
app.get('/fb/events', (req, res) => checkDecorator(req, res, fbapi.fbeventlist, true, true));
app.get('/fb/event/:eventID', (req, res) => checkDecorator(req, res, fbapi.fbevent, true, true));
app.get('/fb/setup/selectGroup', (req, res) => checkDecorator(req, res, fbapi.fbselectgroup, true, true));
app.get('/fb/setup/reselectGroup', (req, res) => checkDecorator(req, res, fbapi.fbreselectgroup, true, true));
app.get('/fb/setup/relationSetup', (req, res) => checkDecorator(req, res, fbapi.fbrelationsetup, true, true));
app.get('/fb/login', (req, res) => checkDecorator(req, res, fbapi.fblogin, true, true));


/*
 * MEMBER MANAGEMENT STUFF
 */
app.get('/members/', (req, res) => checkDecorator(req, res, memberFrontend.memberList, true, true));
app.get('/members/view/:memberID', (req, res) => checkDecorator(req, res, memberFrontend.memberView, true, true));
app.get('/members/edit/:memberID', (req, res) => checkDecorator(req, res, memberFrontend.memberEdit, true, true));

/*
 * EXTRA FEATURES
 */
app.get('/emails/lists/', (req, res) => checkDecorator(req, res, function(req,res){res.render('email-lists', {title: 'Email Lists', includes: api.getIncludes(req)});}, true, true));

/*
 * API STUFF
 */
app.get('/api/email/addresses/:sectionID/:memberID', (req, res) => checkDecorator(req, res, api.emailAddressIndividual, true, false));
app.get('/api/email/addresses/:sectionID&:termID/', (req, res) => checkDecorator(req, res, api.emailAddressSection, true, false));
app.get('/api/getTerms/:sectionID', (req, res) => checkDecorator(req, res, api.termsBySection, true, false));
app.get('/api/getSections/:sectionType', (req, res) => checkDecorator(req, res, api.getListSections, true, true));
app.get('/api/select-section/:sectionID', (req, res) => checkDecorator(req, res, api.selectSection, true, false));
app.get('/api/select-fb/:groupID', (req, res) => checkDecorator(req, res, api.selectFB, true, false));
app.get('/api/select-term/:termID', (req, res) => checkDecorator(req, res, api.selectTerm, true, false));
app.post('/api/login-do', urlencodedParser, (req, res) => api.loginDo(req, res));
app.post('/api/select-do', urlencodedParser, (req, res) => api.selectDo(req, res));
app.post('/api/members/update', urlencodedParser, (req, res) => checkDecorator(req, res, api.updateMember, true, true));
app.post('/api/members/copy', urlencodedParser, (req, res) => checkDecorator(req, res, api.copyMember, true, true));
app.get('/api/event/create', (req, res) => checkDecorator(req, res, api.createEvent, true, true));
app.get('/api/photos/:scoutID&:photoGUID/:jpgSize', (req, res, next) => api.getPhoto(req, res, next));

app.post('/api/youth/create', urlencodedParser, (req, res) => checkDecorator(req, res, api.createYouth, true, true));
app.get('/api/youth/get/', (req, res) => checkDecorator(req, res, api.listYouth, true, true));
app.get('/api/youth/get/byFB/:fbID', (req, res) => checkDecorator(req, res, api.listYouthByFB, true, true));
app.get('/api/youth/get/byOSM/:osmID', (req, res) => checkDecorator(req, res, api.listYouthByOSM, true, true));

const mcache = require('memory-cache');


const cache = (duration) =>{
	return (req, res, next) =>{
		let key = '_express_' + req.originalUrl || req.url
		let cachedbody = mcache.get(key);
		if(cachedbody){
			console.log("sending cached copy");
			res.send(cachedbody);
			return;
		}
		else{
			res.sendResponse = res.send;
			res.send = (body) => {
				mcache.put(key, body, duration * 1000);
				res.sendResponse(body);
			}
			next();
		}
	}
}

/*
 * HOME PAGE
 */
app.get('/', function (req, res) {
	if(api.checkLoggedIn(req)){ api.checkSelection(req, res); res.redirect('/dashboard/');}
	res.render('home', {title: 'Home', includes: api.getIncludes(req)});
});


/*
 * ERROR HANDLING
 */
app.get('*', function(req, res){
	res.status(404);
  if (req.accepts('html')) { res.render('error', { title: 'Error', errorType: 'noRoute', url: req.url , includes: api.getIncludes(req)}); return;}
  if (req.accepts('json')) {res.send({ error: 'Not found' }); return;}
  res.type('txt').send('Not found');
});

/*
 * CHECKING DECORATOR
 */
const checkDecorator = function(req, res, cb, login, section){
	if(login) api.checkLogin(req, res);
	if(section) api.checkSelection(req, res);
	cb(req, res);
}

/*
 * PORT LISTENING
 */
app.listen(3001, function () {
  console.log("Listening on port 3001");
});
