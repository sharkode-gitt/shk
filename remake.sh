#!/bin/bash
# usage: bash remake.sh <3d|2d> ... (3d only): re-render a job from approved; voices come from the cache
cd /d/Emily/shk/3d
ID=${1:-emily-and-lokii-ep1}
node -e "const fs=require('fs'),p='jobs/$ID/status.json',s=JSON.parse(fs.readFileSync(p));s.state='approved';delete s.error;s.history.push({state:'approved',at:new Date().toISOString(),note:'re-render'});fs.writeFileSync(p,JSON.stringify(s,null,2))"
WORKERS=auto npm run story -- make $ID 2>&1 | tail -1
