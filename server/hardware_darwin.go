//go:build darwin

package main

import (
	"encoding/binary"
	"os/exec"
	"strings"

	"golang.org/x/sys/unix"
)

func detectPlatformHardware(info *HardwareInfo) {
	detectDarwin(info)
}

func detectDarwin(info *HardwareInfo) {
	// Total RAM via sysctl
	if val, err := unix.SysctlRaw("hw.memsize"); err == nil && len(val) >= 8 {
		info.TotalRAM = binary.LittleEndian.Uint64(val[:8])
	}

	// Available RAM via vm_stat
	if out, err := exec.Command("vm_stat").Output(); err == nil {
		info.AvailableRAM = parseVMStat(string(out))
	}

	// CPU model
	if val, err := unix.Sysctl("machdep.cpu.brand_string"); err == nil {
		info.CPUModel = strings.TrimSpace(val)
	}
	// Fallback for Apple Silicon (machdep.cpu.brand_string may be empty)
	if info.CPUModel == "" {
		if val, err := unix.Sysctl("hw.model"); err == nil {
			info.CPUModel = strings.TrimSpace(val)
		}
	}

	// GPU via system_profiler
	detectDarwinGPU(info)
}
