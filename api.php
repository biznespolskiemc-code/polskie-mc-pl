<?php
header('Content-Type: application/json');

$server_ip = "POLSKIEMC.HYPIXELS.PL";
$file = "data.json";

/* Pobierz dane z API */
$api = file_get_contents("https://api.mcsrvstat.us/3/$server_ip");
$data = json_decode($api, true);

if(!$data || !isset($data["online"])){
    echo json_encode(["error" => "API_FAIL"]);
    exit;
}

if($data["online"]){
    $online = $data["players"]["online"];
} else {
    $online = 0;
}

/* Wczytaj historię */
if(!file_exists($file)){
    file_put_contents($file, json_encode([]));
}

$history = json_decode(file_get_contents($file), true);

/* Dodaj nowy punkt */
$history[] = [
    "time" => time(),
    "value" => $online
];

/* Zostaw max 7 dni */
$history = array_filter($history, function($p){
    return time() - $p["time"] < 7*24*60*60;
});

/* Zapisz */
file_put_contents($file, json_encode(array_values($history)));

/* Oblicz peaki */
$peakAll = 0;
$peak24 = 0;

foreach($history as $p){
    if($p["value"] > $peakAll) $peakAll = $p["value"];
    if(time() - $p["time"] < 86400 && $p["value"] > $peak24){
        $peak24 = $p["value"];
    }
}

/* Odpowiedź */
echo json_encode([
    "online" => $online,
    "history" => $history,
    "peakAll" => $peakAll,
    "peak24" => $peak24
]);
