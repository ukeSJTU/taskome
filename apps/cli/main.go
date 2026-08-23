package main

import (
	"os"

	"github.com/ukeSJTU/taskome/apps/cli/cmd"
)

func main() {
	os.Exit(cmd.Execute())
}
