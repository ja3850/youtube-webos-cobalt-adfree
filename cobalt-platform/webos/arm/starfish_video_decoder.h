#ifndef STARBOARD_WEBOS_ARM_STARFISH_VIDEO_DECODER_H_
#define STARBOARD_WEBOS_ARM_STARFISH_VIDEO_DECODER_H_

#include <atomic>
#include <cstdio>
#include <string>
#include <vector>

#include <starfish-media-pipeline/StarfishMediaAPIs.h>

#include "starboard/common/condition_variable.h"
#include "starboard/common/mutex.h"
#include "starboard/common/scoped_ptr.h"
#include "starboard/media.h"
#include "starboard/shared/starboard/player/filter/video_decoder_internal.h"
#include "starboard/shared/starboard/player/job_queue.h"
#include "starboard/shared/starboard/player/job_thread.h"

namespace starboard {
namespace shared {
namespace webos {

class StarfishVideoDecoder
    : public starboard::player::filter::VideoDecoder,
      private starboard::player::JobQueue::JobOwner {
 public:
  explicit StarfishVideoDecoder(SbMediaVideoCodec codec);
  ~StarfishVideoDecoder() override;

  void Initialize(const DecoderStatusCB& decoder_status_cb,
                  const ErrorCB& error_cb) override;
  size_t GetPrerollFrameCount() const override { return 1; }
  SbTime GetPrerollTimeout() const override { return 2 * kSbTimeSecond; }
  size_t GetMaxNumberOfCachedFrames() const override { return 12; }
  // Reset retains a native pipeline with its own seek target, even before
  // another compressed packet arrives. Every subsequent seek must retarget it.
  bool NeedsResetOnEverySeek() const override { return true; }
  void SetSeekTime(SbTime seek_to_time) override {
    seek_to_time_.store(seek_to_time);
  }
  void SetPause(bool pause) override;
  void SetPlaybackRate(double playback_rate) override;
  void SetMediaTimeProvider(starboard::player::filter::MediaTimeProvider*
                                media_time_provider) override {
    media_time_provider_ = media_time_provider;
  }
  void WriteInputBuffers(const InputBuffers& input_buffers) override;
  void WriteEndOfStream() override;
  void Reset() override;
  SbDecodeTarget GetCurrentDecodeTarget() override;

 private:
  void InitializePipeline(const SbMediaVideoSampleInfo& sample_info);
  void ApplyHdrInfo(const SbMediaColorMetadata& color_metadata);
  void FeedBuffer(const scoped_refptr<InputBuffer>& input_buffer);
  void RetryPendingBuffer();
  void EnsurePlayingOnDecoderThread(const char* reason, bool force);
  void ApplyPlaybackStateOnDecoderThread();
  void OnLoadCompletedOnDecoderThread();
  void WriteEndOfStreamOnDecoderThread();
  void ResetOnDecoderThread();
  void SignalUnloadCompleted();
  // Linear map from media to pipeline PTS (microseconds) that applies from
  // its anchor onwards; pipeline_per_media is 1/rate outside catch-up spans.
  struct PtsSegment {
    int64_t media_anchor_us;
    int64_t pipeline_anchor_us;
    double pipeline_per_media;
  };

  void LatchSpeedModeOnDecoderThread(const char* reason);
  void RetimePtsOnDecoderThread();
  int64_t ToPipelinePtsUs(int64_t media_pts_us);
  int64_t ToMediaPtsUs(int64_t pipeline_pts_us) const;
  int64_t MapToPipelineLocked(int64_t media_pts_us) const;
  int64_t MapToMediaLocked(int64_t pipeline_pts_us) const;
  int64_t AppendCatchUpLocked(int64_t lag_us, double rate);
  void SyncToClockOnDecoderThread();
  bool HoldForFeedLead(const scoped_refptr<InputBuffer>& input_buffer);
  void RetryAfterFeedLeadWait();
  void WriteDiag(const std::string& line);
  void OnFrameReadyDiag(SbTime frame_time, int64_t pipeline_pts_us);
  void ReportError(const std::string& message);
  void HandlePlayerEvent(int type, int64_t num_value, const char* str_value);
  static void PlayerCallback(int type,
                             int64_t num_value,
                             const char* str_value,
                             void* context);

  SbMediaVideoCodec codec_;
  scoped_ptr<StarfishMediaAPIs> media_api_;
  scoped_ptr<starboard::player::JobThread> decoder_thread_;
  DecoderStatusCB decoder_status_cb_;
  ErrorCB error_cb_;
  scoped_refptr<InputBuffer> pending_buffer_;
  Mutex pipeline_state_mutex_;
  ConditionVariable pipeline_state_condition_;
  bool pipeline_loaded_ = false;
  bool exported_window_acquired_ = false;
  bool stream_ended_ = false;
  bool eos_output_ = false;
  int video_width_ = 0;
  int video_height_ = 0;
  std::string last_hdr_payload_;
  bool play_issued_ = false;
  bool pause_issued_ = false;
  bool startup_play_accepted_ = false;
  double applied_playback_rate_ = -1.0;
  // 'p' PTS rescaling, 'n' native rate with audioOutput=true, 'm' native
  // rate with audioOutput=false; see ReadSpeedMode().
  char speed_mode_ = 'p';
  // Maximum pipeline-time lead of fed video over the last shown frame in 'p'
  // mode (0 = unlimited), so a rate change reaches the screen quickly.
  int64_t feed_lead_limit_us_ = 0;
  bool feed_lead_retry_scheduled_ = false;
  std::atomic<SbTime> seek_to_time_{0};
  std::atomic<bool> pause_requested_{false};
  // Keep this 32-bit so the ARMv7 build does not require libatomic merely to
  // communicate a double between Cobalt's worker and the decoder thread.
  std::atomic<int> playback_rate_millionths_{1000000};
  // Last positive rate Cobalt requested; survives the rate-0 seek preroll.
  std::atomic<int> requested_rate_millionths_{1000000};
  // In 'p' mode the pipeline runs at 1x and video PTS are rescaled instead.
  // A rate change appends segments at the last fed PTS so the pipeline
  // timeline stays continuous and monotonic; newer segments supersede older
  // ones from their anchor on. Written on the decoder thread, read by
  // FRAMEREADY.
  mutable Mutex pts_mutex_;
  std::vector<PtsSegment> pts_segments_{PtsSegment{0, 0, 1.0}};
  int pts_rate_millionths_ = 1000000;
  int64_t last_fed_media_pts_us_ = -1;
  std::atomic<int64_t> last_fed_pipeline_pts_us_{-1};
  // Latest FRAMEREADY, in both domains; -1 until the first one after a seek.
  std::atomic<int64_t> last_frame_media_pts_us_{-1};
  std::atomic<int64_t> last_frame_pipeline_pts_us_{-1};
  std::atomic<SbTime> last_frame_wall_time_{0};
  // Closed-loop A/V sync in 'p' mode (decoder thread only). Cobalt's clock
  // is the audio renderer's; it outlives this decoder.
  starboard::player::filter::MediaTimeProvider* media_time_provider_ = nullptr;
  SbTime sync_latched_at_ = 0;
  // Video-minus-audio offset in pipeline time right after a seek, when
  // Cobalt's preroll has aligned both; held from then on.
  bool sync_baseline_valid_ = false;
  double sync_baseline_sum_us_ = 0.0;
  int sync_baseline_samples_ = 0;
  double sync_baseline_us_ = 0.0;
  // Media PTS from which the latest retime/correction is fully on screen.
  int64_t sync_settled_media_us_ = -1;
  int sync_strikes_ = 0;
  // A/V sync diagnostics, enabled by /tmp/ytaf-av-diag.enable.
  Mutex diag_mutex_;
  FILE* diag_file_ = nullptr;
  long diag_lines_ = 0;
  int64_t diag_last_ms_ = 0;
  int diag_frames_ = 0;
  std::atomic<bool> preroll_frame_sent_{false};
  std::atomic<bool> first_frame_presented_{false};
  std::atomic<bool> load_completed_{false};
  std::atomic<bool> reset_in_progress_{false};
  std::atomic<bool> unload_completed_{false};
  std::atomic<bool> shutting_down_{false};
};

}  // namespace webos
}  // namespace shared
}  // namespace starboard

#endif  // STARBOARD_WEBOS_ARM_STARFISH_VIDEO_DECODER_H_
