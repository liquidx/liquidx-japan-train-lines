#!/bin/bash

VERSION=$(npm pkg get version | sed -E 's/"//g')

echo $VERSION
gh release create $VERSION --title $VERSION --notes "Release $VERSION"
