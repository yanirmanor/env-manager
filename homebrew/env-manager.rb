cask "env-manager" do
  version "1.0.0"
  sha256 "PLACEHOLDER"

  url "https://github.com/yanirmanor/env-manager/releases/download/app-v#{version}/Env.Manager_#{version}_universal.dmg"
  name "Env Manager"
  desc "Native desktop tool to manage .env files across projects"
  homepage "https://github.com/yanirmanor/env-manager"

  app "Env Manager.app"

  zap trash: [
    "~/Library/Application Support/com.env-manager.app",
    "~/Library/Caches/com.env-manager.app",
  ]
end
