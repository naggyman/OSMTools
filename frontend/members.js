var api = require('../api/api');

/*
 * List of Members
 */
exports.memberList = function(req, res){
  var members = [];
	api.apiPerform({sectionid: req.session.selectedSection.section, termid: req.session.selectedSection.term}, 'ext/members/contact/?action=getListOfMembers&sort=dob', (response) => {
		if(!response || !response.items){
			res.render('error', { title: 'Error', errorType: 'noSectionPerm', url: req.url , includes: api.getIncludes(req)}); return;
		}
		members = response.items;
		members.forEach((member) => {member.photoURL = api.getPhotoURL(member.scoutid, member.photo_guid, "100x100_0.jpg")});
		res.render('member_list', {title: 'Members', memberList: members, term: req.params.termID, includes: api.getIncludes(req)});
	}, req.session.logindetails);
}

/*
 * Individual Member View
 */
exports.memberView = function(req, res){
	api.apiPerform({sectionid: req.session.selectedSection.section, termid: req.session.selectedSection.term, scoutid: req.params.memberID}, 'ext/members/contact/?action=getIndividual&context=members', (response) => {
		if(!response){ res.render('error', { title: 'Error', errorType: 'noPermission', url: req.url , includes: api.getIncludes(req)}); return;}
		api.apiPerform({associated_id: req.params.memberID, associated_type: 'member', context: 'members'}, '/ext/customdata/?action=getData&section_id=' + req.session.selectedSection.section, (res2) => {
			member = response.data; memberDetails = res2.data;
			if(!member){res.render('error', { title: 'Error', errorType: 'noPermission', url: req.url , includes: api.getIncludes(req)}); return;}
			member.photoURL = api.getPhotoURL(member.scoutid, member.photo_guid, "200x200_0.jpg");
			res.render('member_view', {title: member.firstname + " " + member.lastname, member: member, memberDetails: memberDetails, includes: api.getIncludes(req)});
		}, req.session.logindetails)
	}, req.session.logindetails);
}

exports.memberEdit = function(req, res){
	api.apiPerform({sectionid: req.session.selectedSection.section, termid: req.session.selectedSection.term, scoutid: req.params.memberID}, 'ext/members/contact/?action=getIndividual&context=members', (response) => {
		if(!response){ res.render('error', { title: 'Error', errorType: 'noPermission', url: req.url , includes: api.getIncludes(req)}); return;}
		member = response.data;
		if(!member){res.render('error', { title: 'Error', errorType: 'noPermission', url: req.url , includes: api.getIncludes(req)}); return;}
		member.photoURL = api.getPhotoURL(member.scoutid, member.photo_guid, "200x200_0.jpg");
		res.render('member_edit', {title: member.firstname + " " + member.lastname, member: member, includes: api.getIncludes(req)});

	}, req.session.logindetails);
}
