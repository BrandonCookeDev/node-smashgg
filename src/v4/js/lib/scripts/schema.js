"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tournament = "\nid\nname\nslug\ncity\npostalCode\naddrState\ncountryCode\nregion\nvenueAddress\nvenueName\ngettingThere\nlat\nlng\ntimezone\nstartAt\nendAt\ncontactInfo\ncontactEmail\ncontactTwitter\ncontactPhone\nownerId";
exports.event = "\nid\nname\nslug\nstate\nstartAt\nnumEntrants\ncheckInBuffer\ncheckInDuration\ncheckInEnabled\nisOnline\nteamNameAllowed\nteamManagementDeadline";
exports.phase = "";
exports.phaseGroup = "";
// smash.gg participant
exports.attendeeContactInfo = "\nid\ncity\nstate\nstateId\ncountry\ncountryId\nname\nnameFirst\nnameLast\nzipcode";
// smash.gg participant
exports.attendee = "\nid\ngamerTag\nprefix\ncreatedAt\nclaimed\nverified\nplayerId\nphoneNumber\ncontactInfo{\n\t" + exports.attendeeContactInfo + "\n}\nconnectedAccounts\nevents{\n\tid\t\n}";
exports.player = "\nid\nname\neventId\nskill\nparticipants{\n\t" + exports.attendee + "\t\n}";
exports.user = "\nid\ngamerTag\nprefix\ncolor\ntwitchStream\ntwitterHandle\nyoutube\nregion\nstate\ncountry\ngamerTagChangedAt";
exports.set = "\nid\neventId\nphaseGroupId\ndisplayScore  \nfullRoundText\nround\nstartedAt\ncompletedAt\nwinnerId\ntotalGames\nstate\nslots(includeByes:false){\n\tid\n\tentrant {\n\t\tid\n\t\tname\n\t\tparticipants {\n\t\t\tid\n\t\t}\n\t}\n}";
exports.game = "\nid\nstate\nwinnerId\norderNum\nselections{\n\tselectionType\n\tselectionValue\n\tentrantId\n\tparticipantId\n}";