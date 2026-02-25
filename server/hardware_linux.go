//go:build linux

package main

func detectPlatformHardware(info *HardwareInfo) {
	detectLinux(info)
}
