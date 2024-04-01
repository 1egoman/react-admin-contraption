#!/bin/bash
npm run build
cd out
cp index.html 200.html
cp new/battles/\[id\].html new/battles/200.html
surge . https://barz-battle-visualizer.surge.sh
