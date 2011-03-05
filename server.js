/*
* TODO
* Bump inactive web users (cause they gone)
*/

var carrier = require('carrier'),
    formidable = require('./formidable'),
    fs = require('fs'),
    http = require('http'),
    net = require('net');
    url = require('url');
    util = require('util');
    require('./date.format.js');


// Run the servers on the ports given, plus the contents of ./PORT_SHIFT
var shift;
try
{
    shift = parseInt(fs.readFileSync(__dirname + '/PORT_SHIFT'));
}
catch (e)
{
    shift = 0;
}


// Run the servers on the ports given, plus the contents of ./PORT_SHIFT
// HTTP Server (index, logs, chat, admin)
http.createServer(httpServ).listen(4000 + shift);
console.log('[HTTP Log] Log server started on port ' + (4000 + shift) + '.');
// Raw chat relay server
net.createServer(netServ).listen(8008 + shift);
console.log('[Chat Log] Chat server started on port ' + (8008 + shift) + '.');


//
// HTTP Server Functions
//
// Callback function for HTTP server (request, response)
function httpServ(req, resp)
{
    var urlParts = url.parse(req.url, true);
    var urlPage = urlParts['pathname'];
    // console.log('[HTTP Log] Connection: ' + urlPage);

    var response = '',
        status = 200,
        headers = { 'Content-Type': 'text/html' },
        headReps = { 'PAGE_TITLE' : 'Awesome Chat',
                     'HEAD_SPACE' : '' };

    // Determine the page title and content to display
    var pageContent = '';
    switch (urlPage)
    {
        case '/logs':
            headReps['PAGE_TITLE'] += ' - Logs';
            headReps['HEAD_SPACE'] += template('logs.css');
            pageContent = compilePage(logContents(urlParts['query']['log']), headReps);
            break;
        case '/upload':
            headReps['PAGE_TITLE'] += ' - Upload';
            pageContent = compilePage(template('upload'), headReps);
            break;
        case '/uploader':
            upload_file(req, resp, headReps);
            break;
        case '/userList':
            for (i in users)
                pageContent += users[i].rank + users[i].username + "<br />";
            resp.writeHead(status, headers);
            resp.write(pageContent);
            resp.end();
            break;
        case '/webLogin':
            pageContent += webLogin(urlParts['query']['nick']);
            break;
        case '/webChat':
            var webus = getWebUser(urlParts['query']['id']);
            if (!webus)
            {
                status = 404;
                break;
            }
            webus.laston = new Date().getTime();
            pageContent += webChat(webus);
            if (pageContent == '')
                status = 404;
            break;
        case '/webSay':
            var webu = getWebUser(urlParts['query']['id']);
            if (!webu)
            {
                status = 404;
                break;
            }
            webu.user = lineHandler(webu.user.conn, urlParts['query']['msg'], webu.user)[0];
            break;
        case '/':
        case '/server':
        case '/index':
            headReps['PAGE_TITLE'] += ' - The Hub';
            headReps['HEAD_SPACE'] += template('index.css');
            headReps['HEAD_SPACE'] += template('index.js');
            pageContent = compilePage(template('index'), headReps);
            break;
        default:
            status = 301;
            headers['Location'] = 'http://cmpt470.csil.sfu.ca:8003/node/index.js';
            pageContent = 'Moved <a href="/node/index.js">here</a>.';
            break;
    }

    if (urlPage != '/uploader')
    {
        // Page Headers
        resp.writeHead(status, headers);
        // send the output
        resp.write(pageContent);
        resp.end();
        // console.log('[HTTP Log] Response sent');
    }
}

// Fills the logs.js page with content (requested log date)
function logContents(logDate)
{
    var response = '',
        dates = [],
        dateHTML = '<option value="">Log Index</option>\n';

    // Get a list of available logs
    var files = fs.readdirSync('./logs/').sort().reverse();
    removeArrayElement(files, '.svn');
    for (i in files)
    {
        dates.push(files[i].substring(4, files[i].length - 5));
        dateHTML += '<option';
        if (dates[i] == logDate)
            dateHTML += ' selected="selected"';
        dateHTML += '>' + dates[i] + '</option>\n';
    }

    try
    {
        // Try reading the requested log
        response += template('log_entry', { 'LOG_NAME' : logDate,
                                            'LOG_DATA' : fs.readFileSync('./logs/log_' + logDate + '.html', 'utf8')});
    }
    catch (e)
    {
        // Didn't exist?  Give an error
        if (logDate)
            response += '<h2>Invalid Log Date: ' + logDate + '</h2>\r\n';

        // Go on and display all available logs
        for (i in dates)
            response += template('log_entry', { 'LOG_NAME' : dates[i],
                                                'LOG_DATA' : fs.readFileSync('./logs/log_' + dates[i] + '.html', 'utf8')});
    }
    return template('logs', { 'LOG_DATES' : dateHTML,
                              'LOG_OUTPUT' : response });
}

// Allows user uploads from the web (request, response, replacements for the header template)
function upload_file(req, res, headReps)
{
    //Send headers...dur
    res.writeHead(200, { 'Content-Type': 'text/html' });

    var form = new formidable.IncomingForm(),
        files = [],
        fields = [],
        filename = '',
        fSize,
        fsUnits = 'B',
        date = new Date(),
        fPath = __dirname + '/uploads/' + date.format("isoDate").replace(new RegExp('-', 'g'), '') + date.format("isoTime").replace(new RegExp(':', 'g'), '') + Math.floor(Math.random()*0x100000000);

    form.uploadDir = __dirname + '/uploads';

    form.on('fileBegin', function(fname, file)
    {
        var date = new Date();
        var idx = file.name.lastIndexOf('.');
        if (idx != -1)
            fPath += file.name.substring(idx, file.name.length);
        filename = file.name;
        file.path = fPath;
    });
    form.parse(req, function(err, fields, files)
    {
        if(files['upload-file'] != undefined)
        {  
       	    fSize = files['upload-file']['size'];
            if (fSize > 1024 * 1024)
            {
                fSize = (fSize / 1024 / 1024).toFixed(1);
            	fsUnits = 'MB';
            }
            else if (fSize > 1024)
            {
                fSize = (fSize / 1024).toFixed(1);
                fsUnits = 'kB';
            }
            res.write(compilePage(template('uploaded',
                                       { 'FILE_NAME' : filename,
                                         'FILE_SIZE' : fSize + ' ' + fsUnits,
                                         'FILE_NEW_NAME' : fPath.substring(fPath.lastIndexOf('/') + 1, fPath.length),
                                         'FILE_PATH' : '.' + fPath.substring(fPath.indexOf('/uploads'), fPath.length)}),
                                       { 'PAGE_TITLE' : 'Awesome Node - Upload Complete' }));
            console.log('[HTTP Log] '+ fSize + fsUnits +' uploaded');
            res.end();
            console.log('[HTTP Log] Response sent');
        }
        else
        {
            res.write(compilePage(template('upload',{}),{'PAGE_TITLE' : 'Awsome Node - Upload'}));
            console.log('[HTTP Log] Response sent');
            res.end();
        }
    });
}

// Creates a new webchat client (response, desired nickname)
function webLogin(nick)
{
    if (getUser(nick) != undefined)
        return 0;

    for (i in badChars)
        if (nick.indexOf(badChars[i]) != -1)
            return 0;

    // Generate a random webID
    while(getWebUser(randNum = 1 + Math.floor(Math.random()*0x000010000)) != undefined);
    
    // Create a socket for the server side connection
    var conn = new WebConn();
        
    var webusr = new WebUser(randNum, new User(nick, "%", '', '', conn, true), new Date().getTime());
    conn.usr = webusr;
    connections.push(conn);
    users.push(webusr.user);
    if (users.length == 1)
        webusr.user.rank = '@';
    webUsers.push(webusr);
    console.log(webusr.user.username + ' connected via WebChat, ' + connections.length +' total.');
    chatSay('* ' + webusr.user.username + ' joined from WebChat!');
    return randNum;
}

// Move data from WebUser's chatBuf to their screen (the WebUser's randNum)
function webChat(usr)
{
    if (!usr)
        return '';

    var tmp = usr.chatBuf;
    usr.chatBuf = '';
    return tmp.replace(new RegExp('\r\n', 'g'), '<br />');
}

// Wraps given data with the page header and footer (page body, [optional] header replacements, [optional] footer replacements)
function compilePage(body, headReps, footReps)
{
    if (!headReps['PAGE_TITLE'])
        headReps['PAGE_TITLE'] = 'Awesome Node';
    if (!headReps['HEAD_SPACE'])
        headReps['HEAD_SPACE'] = '';
    var response = '';
    // File header
    response += template('page_header', headReps);
    // Body content
    response += body;
    // File footer
    response += template('page_footer', footReps);
    return response;
}

// Templating function (template name, [optional] replacements to make)
function template(tname, replacements)
{
    var response = '';
    try
    {
        response = fs.readFileSync('./templates/' + tname + '.html', 'utf8');
        for (key in replacements)
            response = response.replace(new RegExp('{{ ' + key + ' }}', 'g'), replacements[key]);
    }
    catch (e)
    {
        console.log("[Template error] " + e);
        return undefined;
        // do nothing, just catch the error and return undefined.
    }
    return response;
}


//
// Net Server Functions
//
// These are characters not permitted for use in nicknames
var badChars = [' ', '\'', '"', '`', '!', '@', '#', '$', '%', '^', '&', '*'],
    connections = [],
    users = [],
    webUsers = [],
    motd = '';
// Callback function for net server
function netServ(conn)
{
    var old_username,
        currentUsr = new User('^', '^');
    currentUsr.push(users);
    connections.push(conn);
    
    connSay(conn, "*************************************************");
    connSay(conn, "* Hello and welcome to the Awesome Chat server! *");
    connSay(conn, "*************************************************");
    if (motd)
        connSay(conn, "* MOTD: " + motd);
    connSay(conn, "");
    connSay(conn, "Who are you?\r\n> ", true);
    
    carrier.carry(conn, function(line)
    {
        var tmpc = lineHandler(conn, line, currentUsr, old_username);
        currentUsr = tmpc[0];
        old_username = tmpc[1];
    });

    conn.on('close', function()
    {
        var pos = connections.indexOf(conn);
        if (pos >= 0)
        {
            // Remove user
            connections.splice(pos, 1);
            currentUsr.pop(users);
            console.log('[Log] '+ currentUsr.username + ' disconnected.');

            // Admin the last user in the channel
            if (users.length == 1)
            {
                var lastUsr = oneUser();
                if (lastUsr.rank != '@')
                {
                    lastUsr.rank = '@';
                    connSay(lastUsr.conn, '* Because you are the last person in this channel, you are now an administrator!');
                    console.log('[Log: admin] '+ lastUsr.username + ' is now an admin (last user).');
                }
            }
        }
    });
}

// Checks user input and works with it (connection, user input, current user, [optional] their previous username)
function lineHandler(conn, line, currentUsr, old_username)
{
    if (line.indexOf("GET") == 0 || line.indexOf("POST") == 0)
    {
        currentUsr.pop(users);
        currentUsr = new User('%', '%');
        currentUsr.push(users);
        console.log('Web user connected, ' + connections.length + ' total.');
        chatSay('* A web user has joined!');
    }

    if (currentUsr.rank == '%' && !currentUsr.conn)
        return [currentUsr, old_username];

    if (currentUsr.username == '^')
    {
        // Ignore blank line
        if (line == '')
            return [currentUsr, old_username];
        // Don't allow duplicate usernames
        if (getUser(line) != undefined)
        {
            connSay(conn, "* Please choose a nickname that is not in use. [nicknames are not case-sensitive]");
            return [currentUsr, old_username];
        }
        // Don't allow restricted characters
        for (i in badChars)
        {
            if (line.indexOf(badChars[i]) != -1)
            {
                connSay(conn, "* Please enter a nickname that does not contain spaces, quotation marks, '!', '@', '#', '$', '%', '^', '&', or '*'.");
                return [currentUsr, old_username];
            }
        }
        
        currentUsr.pop(users);
        currentUsr = new User(line, '', '', '', conn);
        currentUsr.push(users);

        // The first user in the channel becomes an admin
        if (users.length == 1)
            currentUsr.rank = '@';
        connSay(conn, "");
        connSay(conn, "* Hello "+ currentUsr.rank + currentUsr.username +"!");
        if (users.length == 1)
            connSay(conn, '*  You are the only person in the channel, so you are an administrator!');
        connSay(conn, "*  Use /help to see all the available commands.");
        connSay(conn, "*  There are: "+ connections.length +" people connected.");
        connSay(conn, "");
    
        if (!old_username) // New user
        {
            console.log(currentUsr.username+' connected, '+ connections.length +' total.');
            chatSay('* '+currentUsr.username+' joined!');
        }
        else // Renamed user
        {
            old_username = undefined;
            console.log('[Log: nick] ' + old_username + ' is now known as ' + currentUsr.username);
            chatSay('* ' + old_username + ' is now known as ' + currentUsr.username + '!');
        }
        return [currentUsr, old_username];
    }
    
    //Special commands
    switch (line)
    {
        case '/help':
        case '/?':
            connSay(conn, '\n* Awesome Chat help section *');
            if (currentUsr.rank == '@')
            {
                connSay(conn, '/admin <user> - Makes a user into an admin or non-admin.');
                connSay(conn, '/kick <user> - Kicks a user.');
            }
            connSay(conn, '/nick <name> - Changes your nickname.');
            connSay(conn, '/me <action> - Alerts the chatroom to your action.');
            connSay(conn, '/msg <user> <msg> - Sends a private message to a user.');
            connSay(conn, '/away [msg] - Marks you as away or present.');
            connSay(conn, '/motd [msg] - Gets or sets the channel greeting.');
            connSay(conn, '/who - List of people on the server.');
            connSay(conn, '/help - This help page.');
            connSay(conn, '/quit - Quit the server.');
            connSay(conn, '');
            break;
        case '/who':
        case '/users':
            connSay(conn, '* There are currently ' + connections.length + ' people connected.');
            connSay(conn, '* Users connected:');
            for (i in users)
                connSay(conn, '*  ' + users[i].rank + users[i].username);
            break;
        case '/quit':
        case '/exit':
            console.log('[Log: quit] '+ currentUsr.username);
            chatSay('* '+ currentUsr.username +' left the chat!');
            conn.end();
            break;
        case '/admin':
        case '/admin ':
            if (currentUsr.rank == '@')
                connSay(conn, '* Try "/admin <user>"!');
            else
                chatSay("[" + new Date().format("isoTime") + "] " + currentUsr.username + ": " + line);
            break;
        case '/kick':
        case '/kick ':
            if (currentUsr.rank == '@')
                connSay(conn, '* Try "/kick <user>"!');
            else
                chatSay("[" + new Date().format("isoTime") + "] " + currentUsr.username + ": " + line);
            break;
        case '/nick':
        case '/nick ':
            connSay(conn, "Who would you like to be?:\r\n> ", true);
            old_username = currentUsr.username;
            currentUsr.pop(users);
            currentUsr = undefined;
            break;
        case '/away':
        case '/away ':
            if (currentUsr.status == 'away')
            {
                currentUsr.status = '';
                console.log('[Log: away (back)] '+ currentUsr.username + ' has returned');
                chatSay('* '+ currentUsr.username + ' has returned');
            }
            else
            {
                currentUsr.status = 'away';
                console.log('[Log: away] '+ currentUsr.username + ' is now away');
                chatSay('* '+ currentUsr.username + ' is now away');
            }
            break;
        case '/motd':
        case '/motd ':
            connSay(conn, '* MOTD: ' + motd);
            break;
        case '/me':
        case '/me ':
            connSay(conn, '* Try "/me <action>"');
            break;
        case '/msg':
        case '/msg ':
            connSay(conn, '* Try "/msg <user> <message>"');
            break;
        default:
            // admin command
            if (line.substring(0, 7) == '/admin ')
            {
                line = line.substring(7, line.length);
                if (currentUsr.rank != '@')
                {
                    console.log('[Log: admin failed] '+currentUsr.username+' failed to give admin privileges to ' + line);
                    chatSay("[" + new Date().format("isoTime") + "] " + currentUsr.username + ": /admin " + line);
                    break;
                }
                
                var newAdmin = getUser(line);
                if (!newAdmin)
                {
                    connSay(conn, '* '+ line +' is not a valid user');
                    return [currentUsr, old_username];
                }
                if (newAdmin.rank == '@')
                {
                    newAdmin.rank = '';
                    console.log('[Log: admin] ' + newAdmin.username + ' is no longer an admin');
                    chatSay('* @' + newAdmin.username + ' is no longer an administrator!');
                }
                else
                {
                    newAdmin.rank = '@';
                    console.log('[Log: admin] ' + newAdmin.username + ' is now an admin');
                    chatSay('* @' + newAdmin.username + ' is now an administrator!');
                }
                break;
            }
            // kick command
            if (line.substring(0, 6) == '/kick ')
            {
                line = line.substring(6, line.length);
                if (currentUsr.rank != '@')
                {
                    console.log('[Log: kick failed] '+currentUsr.username+' failed to kick ' + line);
                    chatSay("[" + new Date().format("isoTime") + "] " + currentUsr.username + ": /kick " + line);
                    break;
                }
                
                var kickedUsr = getUser(line);
                if (!kickedUsr)
                {
                    connSay(conn, '* '+ line +' is not a valid user');
                    return [currentUsr, old_username];
                }
                chatSay(kickedUsr.username + " was kicked by " + currentUsr.rank + currentUsr.username);
                connSay(kickedUsr.conn, "GTFO.  Sincerely, " + currentUsr.rank + currentUsr.username);
                kickedUsr.conn.end();
                break;
            }

            // motd command
            if (line.substring(0, 6) == '/motd ')
            {
                if (currentUsr.rank != '@')
                {
                    console.log('[Log: motd failed] '+currentUsr.username+' failed to change the MOTD');
                    connSay(conn, 'Only admins may change the MOTD');
                    break;
                }
                
                motd = line.substring(6, line.length);
                console.log('[Log: motd] ' + motd);
                chatSay('* MOTD: '+ motd);
                break;
            }
        
            // away command
            if (line.substring(0, 6) == '/away ')
            {
                currentUsr.msg = line.substring(6, line.length);
                if (currentUsr.status == 'away')
                {
                    currentUsr.status = '';
                    console.log('[Log: away (back)] '+ currentUsr.username + ' has returned ('+currentUsr.msg+')');
                    chatSay('* '+ currentUsr.username + ' has returned ('+currentUsr.msg+')');
                }
                else
                {
                    currentUsr.status = 'away';
                    console.log('[Log: away] '+ currentUsr.username + ' is now away ('+currentUsr.msg+')');
                    chatSay('* '+ currentUsr.username + ' is now away ('+currentUsr.msg+')');
                }
                break;
            }
        
            // nick command
            if (line.substring(0, 6) == '/nick ')
            {
                line = line.substring(6, line.length);
                // Don't allow duplicate usernames
                if (getUser(line) != undefined)
                {
                    connSay(conn, "* Please choose a nickname that is not in use. [nicknames are not case-sensitive]");
                    return [currentUsr, old_username];
                }
                // Don't allow restricted characters
                for (i in badChars)
                {
                    if (line.indexOf(badChars[i]) != -1)
                    {
                        connSay(conn, "* Please choose a nickname that does not contain spaces, quotation marks, '!', '@', '#', '$', '%', '^', '&', or '*'.");
                        return [currentUsr, old_username];
                    }
                }
                old_username = currentUsr.username;
                currentUsr.username = line;
                console.log('[Log: nick] ' + old_username + ' is now known as ' + currentUsr.username);
                chatSay('* ' + old_username + ' is now known as ' + currentUsr.username + '!');
                break;
            }
        
            // msg command
            if (line.substring(0, 5) == '/msg ')
            {
                var userAndMsg = line.substring(5, line.length);
                var tokenPos = userAndMsg.indexOf(' ');
                var absTokenPos = Math.abs(tokenPos);
                var otherUsr = getUser(userAndMsg.substring(0, absTokenPos));
        
                if (!otherUsr)
                {
                    if (tokenPos == -1)
                        connSay(conn, '* You must include a message!');
                    else
                        connSay(conn, '* User ' + userAndMsg.substring(0, absTokenPos) + ' could not be found!');
                    break;
                }
        
                console.log('[Log: msg] ' + currentUsr.rank + currentUsr.username + ' sent a message to ' + otherUsr.username);
                var output = '* msg from ' + currentUsr.rank + currentUsr.username + ':' + userAndMsg.substring(absTokenPos, userAndMsg.length);
                connSay(conn, output);
                connSay(otherUsr.conn, output);
                break;
            }
        
            // me command
            if (line.substring(0, 4) == '/me ')
            {
                var action = currentUsr.username+' '+line.substring(4, line.length);
                console.log('[Log: me] ' + action);
                chatSay('* '+action);
                break;
            }

            // No command detected, treat input as chat message
            // Let's timestamp everything that is said
            var date = new Date();
            var newline = "["+ date.format("isoTime") +"] "+ currentUsr.username +": "+ line;
            // Send to all users
            chatSay(newline);
            // And log it
            fs.createWriteStream('./logs/log_'+ date.format("isoDate") +'.html', { flags: 'a', encoding: 'utf8'}).write(newline + "\r\n");
            break;
    }
    return [currentUsr, old_username];
}

// Send a message to all connections (message)
function chatSay(cmsg)
{
    for (i in connections)
        connSay(connections[i], cmsg);
}

// Send a message to specific connection (recipient, message, [optional] TRUE to omit trailing newline)
function connSay(connection, cmsg, skipNewLine)
{
    if (!skipNewLine)
        cmsg += '\r\n';
    try
    {
        connection.write(cmsg);
    }
    catch (err)
    {
        // Log and ignore
        console.log('[Chat log] connSay(' + connection + ', ' + cmsg + ', ' + skipNewLine + ') Error: ' + err);
    }
}

// Gets a user by name (username, [optional] TRUE to match case-sensitive)
function getUser(uname, caseSens)
{
    for (i in users)
        if (users[i].equals(uname, caseSens))
            return users[i];
    return undefined;
}

// Gets a WebUser by id (webID)
function getWebUser(id)
{
    for (i in webUsers)
        if (webUsers[i].equals(id))
            return webUsers[i];
    return undefined;
}

// Returns a user ([optional] TRUE for admin only)
function oneUser(admin)
{
    if (!admin)
    {
        for (i in users)
            return users[i];
        return undefined;
    }
    else
    {
        for (i in users)
            if (users[i].rank == '@')
                return users[i];
        return undefined;
    }
}

// Removes all occurances of an element from an array (haystack, needle)
function removeArrayElement(arr, el)
{
    for (i = 0 ; i < arr.length ; i++)
        if (arr[i] == el)
            arr.splice(i--,1); // i-- so we can check the new i-th element (was i+1, is now i)
}


//
// The User and WebUser Classes
//
function User(uname, urank, ustatus, umsg, uconn, webid)
{
    this.username = uname;
    this.rank = urank;
    this.status = ustatus;
    this.msg = umsg;
    this.conn = uconn;
    this.webID = webid;

    this.pop = function(usrs)
    {
        return usrs.splice(usrs.indexOf(this), 1);
    };
    this.push = function(usrs)
    {
        return usrs.push(this);
    };
    this.equals = function(strName, caseSens) // (username to match, [optional] match case sensitive {default=true})
    {
        if (caseSens == undefined || caseSens)
            return (this.username == strName);
        else // caseSens == false
            return (this.username.toLowerCase() == strName.toLowerCase());
    };
}

function WebUser(id, usr, laston)
{
    this.id = id;
    this.user = usr;
    this.laston = laston;
    this.chatBuf = '';
    
    this.pop = function(usrs)
    {
        return usrs.splice(usrs.indexOf(this), 1);
    };
    this.equals = function(wid)
    {
        return (this.id == wid);
    }
}

// WebConn class
function WebConn(webid)
{
    this.usr = getWebUser(webid);
    
    this.write = function (data)
    {
        if ((new Date().getTime() - this.usr.laston) > 5000)
        {
            this.usr.user.conn.end();
            return;
        }
        this.usr.chatBuf += data;
    }
    this.end = function ()
    {
        var pos = connections.indexOf(this.usr.user.conn);
        if (pos >= 0)
        {
            // Remove user
            console.log('[Log] ' + this.usr.user.username + ' disconnected.');
            connections.splice(pos, 1);
            this.usr.user.pop(users);
            this.usr.pop(webUsers);

            // Admin the last user in the channel
            if (users.length == 1)
            {
                var lastUsr = oneUser();
                if (lastUsr.rank != '@')
                {
                    lastUsr.rank = '@';
                    connSay(lastUsr.conn, '* Because you are the last person in this channel, you are now an administrator!');
                    console.log('[Log: admin] '+ lastUsr.username + ' is now an admin (last user).');
                }
            }
        }
    }
}
