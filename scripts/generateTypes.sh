#!/bin/bash

scripts/waitForServer.sh

echo "Using a running server to generating type definitions. Errors and warnings may"
echo "appear in the server's log output. If this fails, make sure a local server is"
echo "running."

echo "...generating SQL schema"
scripts/serverShellCommand.sh "Globals.generateSQLSchema(\"${PWD}\")"
echo "...generating Typescript types"
scripts/serverShellCommand.sh "Globals.generateTypes(\"${PWD}\")"
graphql-codegen --config codegen.yml
