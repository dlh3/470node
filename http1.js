var http = require('http');

http.createServer(httpServ).listen(4000);
function httpServ(req, resp)
{
    // Send a custom header   
    resp.writeHead(200, { 'NodeJS' : 'Like a boss' });

    resp.write('Nothing here?');
    resp.end();
}
