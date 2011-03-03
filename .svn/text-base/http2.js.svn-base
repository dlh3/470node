var http = require('http');

http.createServer(function(req, resp)
{
    // Send a custom header   
    resp.writeHead(200, { 'NodeJS' : 'Like a boss' });

    resp.write('Nothing here?');
    resp.end();
}).listen(4000);
