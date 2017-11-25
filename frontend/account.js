var api = require('../api/api');

exports.dashboardView = function(req, res){
	api.checkLogin(req);
	api.checkSelection(req);

	api.apiPerform({}, '/ext/dashboard/?action=getNextThings&sectionid=' + req.session.selectedSection.section + '&termid=' + req.session.selectedSection.term, (response) => {
		if(!response || !response.birthdays) res.render('error', { title: 'Error', errorType: 'noSectionPerm', url: req.url , includes: api.getIncludes(req)});
		res.render('dashboard', {title: 'Dashboard', nextThings: response, includes: api.getIncludes(req)});
	},req.session.logindetails);
}

exports.loginView = function(req, res){
	if(api.checkLoggedIn(req)){if(req.query.redir){res.redirect(req.query.redir);} else{res.redirect('/');}}
	res.render('login', {title: 'Login', includes: api.getIncludes(req), redirect: req.query.redir, notif: req.query.notif});
}

exports.logout = function(req, res){
	req.session.destroy();
	res.redirect('/login?notif=loggedout');
}

exports.section_selection = function(req, res){
	api.checkLogin(req, res);
	getAllSections((sections) => {
		req.session.avaliablesections = sections;
		res.render('section-selection', {title: 'Select Section', sectionsArray: sections, redirect: req.query.redir, includes: api.getIncludes(req)});
	},req.session.logindetails);
}

var getAllSections = function(cb, cookie){
	api.apiPerform({}, 'api.php?action=getUserRoles', (response) => {
		var sections = [];
		for(section in response){
			var thisSection = {
				group: response[section].groupname,
				name: response[section].sectionname,
				id: response[section].sectionid
			}
			sections.push(thisSection);
		}
		cb(sections);
	}, cookie);
}
