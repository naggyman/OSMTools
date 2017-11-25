var graph = require('fbgraph');
var api = require('./api');
var secrets = require('./secrets')

var conf = {
    client_id:      secrets.fb_client_id,
		client_secret:  secrets.fb_client_secret,
		scope:          'email, user_about_me, user_managed_groups, user_events',
		redirect_uri:   'http://localhost:3000/fb/login'
};


exports.fbprofile = function(req, res){
	checkFBLogin(req, res)

	console.log(req.query)
	graph.get(req.query.url, function(err, response){
		console.log(response);
		res.render('fbprofile', {title: 'Facebook Profile', includes: api.getIncludes(req), user: response});
	})
}

exports.fbeventlist = function(req, res){
	checkFBLogin(req, res)

	console.log(req.query)
	getPaged(req.session.fb.id + "/events", [], function(response){
		console.log(response);
		res.render('fb-events', {title: 'Facebook Profile', includes: api.getIncludes(req), user: response});
	})
}

exports.fbevent = function(req, res){
	checkFBLogin(req, res)

	console.log(req.query)
	graph.get(req.params.eventID + "?fields=description,id,attending_count,can_guests_invite,can_viewer_post,category,cover,declined_count,end_time,event_times,interested_count,maybe_count,name,noreply_count,owner,place,start_time,timezone,type,updated_time,admins,attending,comments,declined,feed,interested,maybe,noreply,photos,picture,posts,roles", function(err, response){
		res.render('fb-event', {title: 'Facebook Profile', includes: api.getIncludes(req), user: response});
	})
}

exports.fbselectgroup = function(req, res){
	if(req.session.fb) res.redirect('/fb/events');
	exports.fbreselectgroup(req, res);
}

exports.fbreselectgroup = function(req, res){
	if(!graph.getAccessToken()) res.redirect('/fb/login');
	graph.get('/me/groups', function(err, response){
		if(!response) res.redirect('/login/fb')
		res.render('fb-group-select', {title: 'Select a Facebook Group', includes: api.getIncludes(req), user: response});
	});
}

exports.fbrelationsetup = function(req, res){
	checkFBLogin(req, res)

	getPaged(req.session.fb.id + '/members/', [], function(fbres){
		api.apiPerform({sectionid: req.session.selectedSection.section, termid: req.session.selectedSection.term}, 'ext/members/contact/?action=getListOfMembers&sort=dob', (osmres) => {
			console.log(fbres.length);

			if(!osmres){
				res.render('error', { title: 'Error', errorType: 'noSectionPerm', url: req.url , includes: api.getIncludes(req)}); return;
			}
			var osmmembers = osmres.items;
			//res.render('member_list', {title: 'Members', memberList: members, term: req.params.termID, includes: api.getIncludes(req)});
			res.render('fb-relationsetup', {title: 'Facebook OSM Relation', includes: api.getIncludes(req), fbusers: fbres, members: osmmembers});
		}, req.session.logindetails);
	})
}

var checkFBLogin = function(req, res){
	console.log("Token: " + graph.getAccessToken() + " SessionID: " + req.session.fb);
	if(!graph.getAccessToken() || !req.session.fb) res.redirect('/fb/login');
}

exports.fblogin = function(req, res){

  // we don't have a code yet
  // so we'll redirect to the oauth dialog
  if (!req.query.code) {
    console.log("Performing oauth for some user right now.");

    var authUrl = graph.getOauthUrl({
        "client_id":     conf.client_id
      , "redirect_uri":  conf.redirect_uri
      , "scope":         conf.scope
    });

    if (!req.query.error) { //checks whether a user denied the app facebook login/permissions
      res.redirect(authUrl);
    } else {  //req.query.error == 'access_denied'
      res.send('access denied');
    }
  }
  // If this branch executes user is already being redirected back with
  // code (whatever that is)
  else {
    console.log("Oauth successful, the code (whatever it is) is: ", req.query.code);
    // code is set
    // we'll send that and get the access token
    graph.authorize({
        "client_id":      conf.client_id,
				"redirect_uri":   conf.redirect_uri,
				"client_secret":  conf.client_secret,
				"code":           req.query.code
    }, function (err, facebookRes) {
      res.redirect('/fb/setup/selectGroup');
    });
  }
}

var getPaged = function (url, data, cb){
	graph.get(url, function(err, res) {
		res.data.forEach((dataElem) => {
			data.push(dataElem)
		});
		if(res.paging && res.paging.next) {
			getPaged(res.paging.next, data, cb);
  	}
		else{
			cb(data);
		}
	});
}
