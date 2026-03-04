cask "env-manager" do
  version "1.0.0"
  sha256 "b394da33fe4297d2262bee601e1147a6fb0fffe134e2ade27d1794a4718cf8ad"

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
