<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');

$port = getenv('API_PROXY_PORT');
if (!is_string($port) || trim($port) === '') {
  $port = getenv('PORT');
}
if (!is_string($port) || trim($port) === '') {
  $port = '3000';
}

$port = preg_replace('/[^0-9]/', '', $port) ?: '3000';
$target = 'http://127.0.0.1:' . $port . '/api/posts';
$resp = @file_get_contents($target);

if ($resp === false) {
  $err = error_get_last();
  echo "FAILED\n";
  echo "TARGET: " . $target . "\n";
  if ($err) {
    echo $err['message'] . "\n";
  }
  exit(1);
}

echo "OK\n";
echo "TARGET: " . $target . "\n";
echo substr($resp, 0, 200) . "\n";
