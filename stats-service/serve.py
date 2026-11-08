"""Loopback-only preview. Never exposes the research database on the LAN."""
import argparse,json,sqlite3,time
from contextlib import closing
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from catalogue import query

ROOT=Path(__file__).resolve().parents[1]
def handler(database,port):
 class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kw):super().__init__(*args,directory=str(ROOT),**kw)
    def log_message(self,*args):pass
    def do_GET(self):
        if self.headers.get('Host')!=f'127.0.0.1:{port}':return self.send_error(403)
        path=urlparse(self.path)
        if path.path=='/':self.path='/stats-preview.html';return super().do_GET()
        if path.path.startswith('/stats-api/'):
            started=time.perf_counter()
            try:
                with closing(sqlite3.connect(f'file:{database}?mode=ro',uri=True)) as con:
                    if path.path=='/stats-api/meta':data=json.loads(con.execute("SELECT value FROM stats_meta WHERE key='catalogue'").fetchone()[0])
                    elif path.path=='/stats-api/query':data=query(con,parse_qs(path.query))
                    else:return self.send_error(404)
                payload=json.dumps(data,ensure_ascii=False).encode();self.send_response(200);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','private, max-age=0');self.send_header('Server-Timing',f'sql;dur={(time.perf_counter()-started)*1000:.2f}');self.send_header('Content-Length',str(len(payload)));self.end_headers();self.wfile.write(payload)
            except ValueError as e:self.send_error(400,str(e))
            return
        # Only public UI assets are served. Service files and private datasets are not downloadable.
        if path.path.startswith('/stats-service/') or '..' in path.path:return self.send_error(403)
        return super().do_GET()
 return Handler
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('database');p.add_argument('--port',type=int,default=8778);args=p.parse_args()
 server=ThreadingHTTPServer(('127.0.0.1',args.port),handler(Path(args.database).resolve().as_posix(),args.port));print(f'Stats preview: http://127.0.0.1:{args.port}/',flush=True);server.serve_forever()
