#!/bin/bash
#
for f in $(ls dist); do
  echo "Cleaning $f"
  rm -rf $f
done

echo "Cleaning styles.css"
rm styles.css
