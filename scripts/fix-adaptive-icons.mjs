import { writeFileSync } from "node:fs";

const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;

for (const name of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
  writeFileSync(`android/app/src/main/res/mipmap-anydpi-v26/${name}`, xml);
}
