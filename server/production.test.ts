// @vitest-environment node
import { it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { magicFixture } from "../src/tests/magic-fixture";

it("compiled Vercel ESM function loads in native Node and serves real HTTP requests", () => {
  const directory = mkdtempSync(join(tmpdir(), "threadzero-api-runtime-"));
  try {
    execFileSync(
      process.execPath,
      [
        "node_modules/typescript/bin/tsc",
        "-p",
        "tsconfig.api.json",
        "--noEmit",
        "false",
        "--outDir",
        directory,
      ],
      { stdio: "pipe" },
    );
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({ type: "module" }),
    );
    symlinkSync(
      join(process.cwd(), "node_modules"),
      join(directory, "node_modules"),
      "dir",
    );
    const script = `
      import {createServer} from 'node:http';
      import assert from 'node:assert/strict';
      const nativeFetch=globalThis.fetch;
      let providerStatus=200, invalid=false, timeout=false, calls=0;
      process.env.GROQ_API_KEY='synthetic-runtime-test';
      process.env.GROQ_MODEL='openai/gpt-oss-20b';
      process.env.UPSTASH_REDIS_REST_URL='https://test.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN='synthetic-budget-test';
      globalThis.fetch=async(url, options)=>{
        if(String(url).includes('test.upstash.io')) return Response.json({result:1});
        assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
        assert.equal(JSON.parse(options.body).model,'openai/gpt-oss-20b');
        calls++;
        if(timeout) throw new DOMException('suppressed-provider-details','TimeoutError');
        if(providerStatus!==200) return new Response('suppressed-provider-details',{status:providerStatus});
        return Response.json({choices:[{finish_reason:'stop',message:{content:invalid?'invalid':JSON.stringify(${JSON.stringify(magicFixture())})}}]});
      };
      const {default:handler}=await import('./api/untangle.js');
      const server=createServer((req,res)=>{
        if(req.url==='/api/untangle') void handler(req,res);
        else {res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
      });
      await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
      const base='http://127.0.0.1:'+server.address().port;
      const body=JSON.stringify({text:'Buy tuna before feeding the cat.',consent:true,today:'2026-10-18',timeZone:'Asia/Kolkata'});
      const results=[];
      async function check(name,status,raw=body,method='POST',path='/api/untangle'){
        const r=await nativeFetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base.replace('http:', 'https:')},...(method==='POST'?{body:raw}:{})});
        const value=await r.text();
        assert.equal(r.status,status,name);
        assert.ok(!value.includes('synthetic-runtime-test') && !value.includes('suppressed-provider-details'));
        if(path==='/api/untangle') {assert.match(r.headers.get('content-type'),/application\\/json/);assert.equal(r.headers.get('cache-control'),'no-store');}
        if(name==='success') assert.equal(JSON.parse(value).proposal.tasks.length,5);
        results.push(name);
      }
      try {
        await check('method',405,undefined,'GET');
        delete process.env.GROQ_API_KEY;
        await check('missing-key',503);
        process.env.GROQ_API_KEY='synthetic-runtime-test';
        await check('malformed',400,'{');
        await check('invalid-body',400,'{}');
        await check('oversized',413,JSON.stringify({text:'x'.repeat(13000)}));
        await check('missing-route',404,undefined,'GET','/api/missing');
        assert.equal(calls,0);
        await check('success',200);
        providerStatus=429;await check('rate-limit',429);
        providerStatus=401;await check('authentication',401);
        providerStatus=200;invalid=true;await check('invalid-model',502);
        invalid=false;timeout=true;await check('timeout',504);
        assert.equal(calls,5);
        console.log(JSON.stringify(results));
      }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    `;
    writeFileSync(join(directory, "probe.mjs"), script);
    const result = execFileSync(
      process.execPath,
      [join(directory, "probe.mjs")],
      { encoding: "utf8", timeout: 20000, stdio: "pipe" },
    );
    expect(JSON.parse(result)).toEqual([
      "method",
      "missing-key",
      "malformed",
      "invalid-body",
      "oversized",
      "missing-route",
      "success",
      "rate-limit",
      "authentication",
      "invalid-model",
      "timeout",
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 30000);
