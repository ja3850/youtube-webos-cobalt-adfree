#ifndef STARBOARD_WEBOS_ARM_STARFISH_LOAD_OPTIONS_H_
#define STARBOARD_WEBOS_ARM_STARFISH_LOAD_OPTIONS_H_

#include <cstdio>
#include <string>

namespace starboard {
namespace shared {
namespace webos {

// On-device experiments with Starfish Load() options: the contents of
// /tmp/ytaf-load-extra, a JSON member list such as
//   "transmission":{"trickType":"client-side"},"queryPosition":true
// are appended to the payload's "option" object. Later duplicate keys are
// expected to override earlier ones. Read on every Load(); absent by default.
// The resulting payload is written to /tmp/ytaf-last-load.json.
inline std::string WithExtraLoadOptions(const std::string& payload) {
  FILE* file = std::fopen("/tmp/ytaf-load-extra", "r");
  if (!file) {
    return payload;
  }
  std::string extra;
  char buffer[512];
  size_t read;
  while ((read = std::fread(buffer, 1, sizeof(buffer), file)) > 0) {
    extra.append(buffer, read);
  }
  std::fclose(file);
  const size_t first = extra.find_first_not_of(" \t\r\n,");
  const size_t last = extra.find_last_not_of(" \t\r\n,");
  if (first == std::string::npos) {
    return payload;
  }
  extra = extra.substr(first, last - first + 1);
  // Both pipelines end their payload with option}, args[0]}, args], root}.
  static const char kTail[] = "}}]}";
  const size_t tail_size = sizeof(kTail) - 1;
  if (payload.size() < tail_size ||
      payload.compare(payload.size() - tail_size, tail_size, kTail) != 0) {
    return payload;
  }
  const std::string result =
      payload.substr(0, payload.size() - tail_size) + "," + extra + kTail;
  // Keep the last spliced payload readable; firmware logs truncate it.
  if (FILE* out = std::fopen("/tmp/ytaf-last-load.json", "w")) {
    std::fputs(result.c_str(), out);
    std::fclose(out);
  }
  return result;
}

}  // namespace webos
}  // namespace shared
}  // namespace starboard

#endif  // STARBOARD_WEBOS_ARM_STARFISH_LOAD_OPTIONS_H_
