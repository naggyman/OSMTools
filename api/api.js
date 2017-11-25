
var request = require('request');
var cachedrequest = require('cached-request');
var secrets = require('./secrets');
var stream = require('stream');
var fs = require('fs');

var redis = require('redis');
require('redis-streams')(redis);
var redisClient = redis.createClient({'return_buffers': true});
exports.redis = redisClient;

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/my_database');
var Schema = mongoose.Schema;

// create a schema
var youthMemberSchema = new Schema({
  facebookID: Number,
	osmID: Number,
	name: String,
	permissions: {
		emailSection: Boolean
	}
});

var youthMember = mongoose.model('youthMember', youthMemberSchema);


/*
 * Used to perform any api calls
 *
 * Params:
 * List - Called with a list of parameters (list) for the body of the request
 * URL - Used to specify the location of the api call
 * cb - callback function (called with the JSON result)
 * cookie - used to parse the cookies from the user
 */
exports.apiPerform = function(list, url, cb, cookie) {
    var body = '';

		if(cookie){list.userid = cookie.userid; list.secret = cookie.secret;}
		list.token = secrets.token; list.apiid = secrets.apiid;

    for (key in list) {
      if(typeof list[key] == 'undefined'){return;}
      if (list.hasOwnProperty(key)) {body += '&' + key + "=" + encodeURIComponent(list[key]);}
    }

		console.log("REQUEST: " + secrets.base + url + "\nBODY:" + body + "\n");
		request({url: secrets.base + url, method: 'POST', form: body}, (error, response, body) => {
				if (!error && response.statusCode == 200) { console.log(body); cb(JSON.parse(body));}
				else if (error) { console.error(error); cb(null);}
				else {console.log(body); cb(null);}
		});

};


/*
 * Used to complete a login request (including putting cookies on the user's browser)
 */
exports.loginDo = function (req, res){
	if (!req.body) return res.sendStatus(400)
	exports.apiPerform({email: req.body.email, password: req.body.password}, 'users.php?action=authorise', (response) => {
		 //checks login details were correct
		 if(!response.secret || !response.userid){
			 res.redirect("/login/?notif=userpass" + ((req.body.redir)? "&redir=" + req.body.redir : ""));
		 }
		 //correct login, time to create a cookie to store the secret and id and then redirect away
		 else{
			 req.session.logindetails = {secret: response.secret, userid: response.userid};
			 if(req.body.redir){res.redirect(req.body.redir);}
			 else{res.redirect("/dashboard/");}
		 }
	 });
}


/*
 * Used to complete a request to change the user's current selected section
 */
exports.selectDo = function (req, res){
	if (!req.body) return res.sendStatus(400)
	req.session.selectedSection = {section: req.body.sectionForm, term: req.body.termForm, string: req.body.stringForm, termString: req.body.termStrForm};

	if(req.body.redirectForm) res.redirect(req.body.redirectForm);
	else res.redirect("/");
}

exports.updateMember = function(req, res){
	if(!req.body) return res.sendStatus(400)

	exports.apiPerform({scoutid: req.body.scoutid, column: req.body.column, value: req.body.value, sectionid: req.body.sectionid},'ext/members/contact/?action=update',function(response){res.send(response);} ,
	req.session.logindetails)

}

exports.copyMember = function(req, res){
	if(!req.body) return res.sendStatus(400)

	exports.apiPerform({scouts: req.body.scouts, targetSection: req.body.targetSection, type: 'Copy'},'ext/members/contact/actions/?action=transferMember&sectionid=' + req.session.selectedSection.section,function(response){res.send(response);} ,
	req.session.logindetails)

}

exports.createYouth = function(req, res){
	if(!req.body) return res.sendStatus(400)

	var newYouth = new youthMember({
		facebookID: req.body.facebookID,
		osmID: req.body.osmID,
		name: req.body.name,
		permissions: req.body.permissions
	})

	newYouth.save(function(err){
		if(err) res.send({'error': 'Unable to create new Youth'})
		else res.send({'success':true})
	})
}

exports.listYouth = function(req, res){
	youthMember.find({}, function(err, youth) {
	  if (err) res.send({error: true})

	  // object of all the users
	  console.log(youth);
		res.send(JSON.stringify(youth));
	});
}

exports.listYouthByFB = function(req, res){
	youthMember.find({facebookID: req.params.fbID}, function(err, youth){
		if (err) res.send({error: true})

		res.send(JSON.stringify(youth));
	})
}

exports.listYouthByOSM = function(req, res){
	youthMember.find({osmID: req.params.osmID}, function(err, youth){
		if (err) res.send({error: true})

		res.send(JSON.stringify(youth));
	})
}

//used to create a new event. TODO move to a POST setup (it is temporarily on a GET, while the frontend side is sorted)
exports.createEvent = function(req, res){
	//if(!req.body) return res.sendStatus(400)
	exports.apiPerform({
		name: req.query.name,
		location: req.query.location,
		startdate: req.query.startdate,
		starttime: req.query.starttime,
		enddate: req.query.enddate,
		endtime: req.query.endtime,
		attendancelimit: 0,
		limitincludesleaders:false,
		cost: '',
		tbc: 'no',
		confdate: req.query.startdate,
		allowchanges: false,
		disablereminders: true,
		allowbooking: true,
		attendancereminder: 0,
		notes: '',
	},
		'ext/events/event/?action=add&sectionid=' + req.session.selectedSection.section, function(response){res.send(response)}, req.session.logindetails)
}
/*
 * Used to load a photo of a specified scoutID, photoGUID and jpgSize
 * Uses getPhotoURLI in order to determine the address
 * Uses redis cluster to cache images
 */
exports.getPhoto = function(req, res){
	var photoURL = getPhotoURLI(req.params.scoutID, req.params.photoGUID, req.params.jpgSize);

	/* attempts to load from redis. if the returned object is null (as in, the photo is not cached)
	then the photo is loaded from OSM and cached */
	redisClient.get(photoURL, function(err, object) {
		if(!object){
			request.get(photoURL)
				.pipe(redisClient.writeThrough(photoURL, 30000))
				.pipe(res);
			return;
		}
		res.setHeader('Content-Type','image/jpeg');
		res.end(object);
	});

}

/*
 * Gets a photoURL for a specified scoutID and photoGUID
 * jpgSize is either '100x100_0.jpg' or '200x200_0.jpg'
 */
var getPhotoURLI = function(scoutID, photoGUID, jpgSize){
	if(!scoutID || !photoGUID) return secrets.base + "graphics/NoPhoto.png";
	var scoutIDFolder = 0;
	if(scoutID < 1000){scoutIDFolder = 0;}
	else if(scoutID < 10000){scoutIDFolder = sigFigs(scoutID,1)}
	else scoutIDFolder = sigFigs(scoutID,2);
	return "https://osm.scouts.org.nz/sites/nz.onlinescoutmanager.com/public/member_photos/" + scoutIDFolder + "/" + scoutID + "/" + photoGUID + "/" + jpgSize;
}

/*
 * Used to obtain an internal image link for a potenitally cached
 * version of a photo
 */
exports.getPhotoURL = function(scoutID, photoGUID, jpgSize){
	if(!scoutID || !photoGUID) return secrets.base + "graphics/NoPhoto.png";
	return "/api/photos/"+ scoutID + "&" + photoGUID + "/" + jpgSize;
}

/*
 * Helper method to determine the weird 'middle' value in the API Request
 */
function sigFigs(n, sig) {
  var mult = Math.pow(10, sig - Math.floor(Math.log(n) / Math.LN10) - 1);
  return Math.floor(n * mult) / mult;
}


/*
 * Used to change a user's selection to a new section
 */
exports.selectSection = function(req, res) {
	exports.apiPerform({}, 'api.php?action=getTerms', (response) => {
		var now = new Date();
		for(section in response){
			//only operate on correct 'section'
			if(req.params.sectionID === section){
				//iterate over terms in order to find the 'current' term to automatically open
				response[section].forEach((thisTerm) =>{
					//is current term?
					var start = new Date(thisTerm.startdate); var end = new Date(thisTerm.enddate);
					if(start.getTime() <= now.getTime() && now.getTime() <= end.getTime()){
						//it is!
						var name = "";

						//get section name
						req.session.avaliablesections.forEach((section) => {
							if(section.id == req.params.sectionID){
								name = section.group + ": " + section.name;
							}
						});

						//put cookie on system
						req.session.selectedSection = {section: req.params.sectionID, term: thisTerm.termid, string: name, termString: thisTerm.name, terms: response[section]};
						if(req.query.redir) res.redirect(req.query.redir);
						else res.redirect('/');
					}
				});
			}
		}
		res.render('error', { title: 'Error', errorType: 'noSectionPerm', url: req.url , includes: exports.getIncludes(req)}); return;
	}, req.session.logindetails);
}

/*
 * Used to select a term within the current section
 * Similar to above, but no need to figure out a section
 */
exports.selectTerm = function(req, res) {
	exports.apiPerform({}, 'api.php?action=getTerms', (response) => {
		var now = new Date();
		for(section in response){
			if(req.session.selectedSection.section === section){
				response[section].forEach((thisTerm) =>{
					if(req.params.termID === thisTerm.termid){

						var name = "";
						req.session.avaliablesections.forEach((section) => {
							if(section.id == req.session.selectedSection.section){
								name = section.group + ": " + section.name;
							}
						});

						req.session.selectedSection = {section: req.session.selectedSection.section, term: thisTerm.termid, string: name, termString: thisTerm.name, terms: response[section]};
						if(req.query.redir) res.redirect(req.query.redir);
						else res.redirect('/');
					}
				});
			}
		}
	}, req.session.logindetails);
}

/*
 * Used to select a facebook groupID as the current section's id
 */
exports.selectFB = function(req, res) {
	var group = req.params.groupID;
	req.session.fb = {id: group};
	if(req.query.redir) res.redirect(req.query.redir);
	else res.redirect('/fb/setup/relationSetup');
}

/*
 * Used to get a list of email addresses for a individual scoutid
 */
exports.emailAddressIndividual = function(req, res){
	exports.apiPerform({}, 'ext/members/email/?action=getEmailsFromContacts&sectionid=' + req.params.sectionID + '&scouts=' + req.params.memberID + '&delimiter=,', (response) => {
		var emailarr = response.emails.match(/<(.*?)>/g);
		var emails3 = [];
		for (var i=0; i<emailarr.length; i++)
   		emails3[i] = emailarr[i].substr(1,emailarr[i].length-2);
		res.write(JSON.stringify(emails3));
		res.end();
	}, req.session.logindetails);
}

/*
 * Used to get a list of email addresses for a section
 */
exports.emailAddressSection = function(req, res){
	exports.apiPerform({sectionid: req.params.sectionID, termid: req.params.termID}, 'ext/members/contact/?action=getListOfMembers&sort=dob', (response) => {
		members = response.items;
		var memberIDs = [];
		members.forEach((member) => {memberIDs.push(member.scoutid)});
		var str = memberIDs.join(", ");
		res.redirect('/api/email/addresses/' + req.params.sectionID + '/' + str);
	}, req.session.logindetails);
}

/*
 * Determines a list of terms for a specified section
 */
exports.termsBySection = function(req, res){
	exports.apiPerform({}, 'api.php?action=getTerms', (response) => {
		if(!response) res.render('error', { title: 'Error', errorType: 'noPermission', url: req.url , includes: getIncludes(req)}); return;
		for(section in response){
			if(req.params.sectionID === section){
				res.json(response[section]);
			}
		}
	}, req.session.logindetails);
}

exports.getListSections = function(req, res){
	exports.apiPerform({}, 'ext/members/sectionplanning/?action=listSections&page=transfer&section=' + req.params.sectionType, (response) => {
		res.send(response);
	}, req.session.logindetails)
}
/*
 * Checks that a logindetails session cookie is present
 */
exports.checkLogin = function(req, res){
	if(!req.session.logindetails){res.redirect('/login/?redir='+req.url);}
}

/*
 * Checks that a section has been selected
 */
exports.checkSelection = function(req, res){
	if(!req.session.selectedSection){res.redirect('/section-selection/?redir='+req.url);}
}

/*
 * Checks that a logindetails session cookie is present
 */
exports.checkLoggedIn = function(req){
	return req.session.logindetails;
}

/*
 * Used to get an object of useful variables for most pug templates
 */
exports.getIncludes = function(req){
	var includes = {
		loggedIn: req.session.logindetails ? true : false,
		request: req.url
	}
	if(req.session.fb) includes.fb = req.session.fb;
	if(req.session.selectedSection) includes.section = req.session.selectedSection;
	if(req.session.avaliablesections) includes.avaliable = req.session.avaliablesections;
	return includes;
}
