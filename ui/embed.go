package ui

import (
	"embed"
	"io/fs"
)

// FS holds the raw embedded files (dist/ directory)
//
//go:embed dist/*
var FS embed.FS

// Dist is the dist/ subdirectory as an fs.FS, ready to serve
var Dist, _ = fs.Sub(FS, "dist")
