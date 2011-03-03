var http = require('http');

http.createServer(httpServ).listen(4000);
function httpServ(req, resp)
{
    // Send a 302 and redirect
    resp.writeHead(302, { 'Location' : 'http://www.cs.sfu.ca/CC/470/ggbaker' });

    resp.write('Nothing here?');
    resp.end();
}
