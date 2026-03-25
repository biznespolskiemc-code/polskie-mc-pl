<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$serverIp = 'POLSKIEmc.hypixels.pl';
$dataDir  = __DIR__ . '/data';
$dataFile = $dataDir . '/stats.json';

// Utworzenie katalogu data/ jeśli nie istnieje
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0775, true);
}

// Funkcje pomocnicze
function readJsonFile(string $file): array {
    if (!file_exists($file)) return [];
    $raw = file_get_contents($file);
    $json = json_decode($raw, true);
    return is_array($json) ? $json : [];
}

function writeJsonFile(string $file, array $data): void {
    file_put_contents(
        $file,
        json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
        LOCK_EX
    );
}

function fetchServerData(string $serverIp): ?array {
    $url = 'https://api.mcsrvstat.us/3/' . rawurlencode($serverIp);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    $body = curl_exec($ch);
    curl_close($ch);

    if ($body === false || $body === null) return null;

    $json = json_decode($body, true);
    return is_array($json) ? $json : null;
}

// Dzisiejsza data
$today    = date('d.m.Y');
$todayKey = 'gracze_np_w_' . $today;

// Pobranie danych z serwera
$server = fetchServerData($serverIp);

$currentPlayers = 0;
$serverMax = 0;
$online = false;

if (is_array($server)) {
    $online = !empty($server['online']);
    $currentPlayers = (int)($server['players']['online'] ?? 0);
    $serverMax = (int)($server['players']['max'] ?? 0);
    if (!$online) $currentPlayers = 0;
}

// Odczyt aktualnego pliku JSON
$stats = readJsonFile($dataFile);

// Reset dziennego rekordu po zmianie dnia
if (($stats['data_dnia'] ?? '') !== $today) {
    $stats = ['data_dnia' => $today];
}

// Aktualizacja danych
$stats['data_dnia'] = $today;
$stats['online'] = $online;
$stats['gracze'] = $currentPlayers;
$stats['max_serwera'] = $serverMax;
$stats['aktualizacja'] = date(DATE_ATOM);

// Ustawienie lub aktualizacja dziennego rekordu
if (!isset($stats[$todayKey])) $stats[$todayKey] = 0;
$stats[$todayKey] = max((int)$stats[$todayKey], $currentPlayers);

// Zapis do pliku JSON
writeJsonFile($dataFile, $stats);

// Zwrócenie danych w formacie JSON
echo json_encode($stats, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
