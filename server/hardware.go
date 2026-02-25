package main

import (
	"bufio"
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
)

// HardwareInfo describes the host machine's hardware capabilities.
type HardwareInfo struct {
	TotalRAM     uint64 `json:"total_ram"`     // bytes
	AvailableRAM uint64 `json:"available_ram"` // bytes
	CPUCores     int    `json:"cpu_cores"`
	CPUModel     string `json:"cpu_model"`
	GPUInfo      string `json:"gpu_info"`   // empty if not detected
	GPUMemory    uint64 `json:"gpu_memory"` // bytes, 0 if not detected
	OS           string `json:"os"`
	Arch         string `json:"arch"`
}

func handleGetHardware() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		info := detectHardware()
		writeJSON(w, http.StatusOK, info)
	}
}

func detectHardware() HardwareInfo {
	info := HardwareInfo{
		CPUCores: runtime.NumCPU(),
		OS:       runtime.GOOS,
		Arch:     runtime.GOARCH,
	}

	detectPlatformHardware(&info)
	return info
}

// --- Linux detection ---

func detectLinux(info *HardwareInfo) {
	// RAM from /proc/meminfo
	if f, err := os.Open("/proc/meminfo"); err == nil {
		defer f.Close()
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "MemTotal:") {
				info.TotalRAM = parseProcMemLine(line)
			} else if strings.HasPrefix(line, "MemAvailable:") {
				info.AvailableRAM = parseProcMemLine(line)
			}
		}
	}

	// CPU model from /proc/cpuinfo
	if f, err := os.Open("/proc/cpuinfo"); err == nil {
		defer f.Close()
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "model name") {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					info.CPUModel = strings.TrimSpace(parts[1])
					break
				}
			}
		}
	}

	// GPU via nvidia-smi
	detectLinuxGPU(info)
}

// parseProcMemLine parses a line like "MemTotal:       16384000 kB"
func parseProcMemLine(line string) uint64 {
	parts := strings.Fields(line)
	if len(parts) < 2 {
		return 0
	}
	val, err := strconv.ParseUint(parts[1], 10, 64)
	if err != nil {
		return 0
	}
	// /proc/meminfo values are in kB
	return val * 1024
}

func detectLinuxGPU(info *HardwareInfo) {
	out, err := exec.Command("nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits").Output()
	if err != nil {
		return
	}
	line := strings.TrimSpace(string(out))
	if line == "" {
		return
	}
	// First line only (first GPU)
	parts := strings.SplitN(strings.Split(line, "\n")[0], ", ", 2)
	if len(parts) >= 1 {
		info.GPUInfo = strings.TrimSpace(parts[0])
	}
	if len(parts) >= 2 {
		if mb, err := strconv.ParseUint(strings.TrimSpace(parts[1]), 10, 64); err == nil {
			info.GPUMemory = mb * 1024 * 1024 // MiB to bytes
		}
	}
}

// --- Helpers ---

// parseMemoryString parses strings like "8 GB", "2048 MB", "16384 MB" into bytes.
func parseMemoryString(s string) uint64 {
	s = strings.TrimSpace(s)
	parts := strings.Fields(s)
	if len(parts) < 2 {
		return 0
	}
	val, err := strconv.ParseFloat(parts[0], 64)
	if err != nil {
		return 0
	}
	unit := strings.ToUpper(parts[1])
	switch unit {
	case "GB":
		return uint64(val * 1024 * 1024 * 1024)
	case "MB":
		return uint64(val * 1024 * 1024)
	case "TB":
		return uint64(val * 1024 * 1024 * 1024 * 1024)
	default:
		return uint64(val)
	}
}

// parseVMStat extracts available memory from vm_stat output.
// Available = (free + inactive) * page_size
func parseVMStat(output string) uint64 {
	var pageSize uint64 = 16384 // default for Apple Silicon
	lines := strings.Split(output, "\n")

	// First line: "Mach Virtual Memory Statistics: (page size of XXXX bytes)"
	if len(lines) > 0 {
		if idx := strings.Index(lines[0], "page size of "); idx != -1 {
			s := lines[0][idx+len("page size of "):]
			s = strings.TrimSuffix(strings.TrimSpace(s), " bytes)")
			if v, err := strconv.ParseUint(s, 10, 64); err == nil {
				pageSize = v
			}
		}
	}

	values := map[string]uint64{}
	for _, line := range lines {
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		valStr := strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(parts[1]), "."))
		if v, err := strconv.ParseUint(valStr, 10, 64); err == nil {
			values[key] = v
		}
	}

	free := values["Pages free"]
	inactive := values["Pages inactive"]
	return (free + inactive) * pageSize
}

func detectDarwinGPU(info *HardwareInfo) {
	out, err := exec.Command("system_profiler", "SPDisplaysDataType", "-json").Output()
	if err != nil {
		return
	}

	var result struct {
		SPDisplaysDataType []struct {
			ChipsetModel string `json:"chipset_model"`
			VRAM         string `json:"spdisplays_vram"`
			VRAMShared   string `json:"spdisplays_vram_shared"`
		} `json:"SPDisplaysDataType"`
	}
	if err := json.Unmarshal(out, &result); err != nil || len(result.SPDisplaysDataType) == 0 {
		return
	}

	gpu := result.SPDisplaysDataType[0]
	info.GPUInfo = gpu.ChipsetModel

	// Parse VRAM string (e.g. "8 GB", "2048 MB")
	vramStr := gpu.VRAM
	if vramStr == "" {
		vramStr = gpu.VRAMShared
	}
	if vramStr != "" {
		info.GPUMemory = parseMemoryString(vramStr)
	}
}
