<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');
$resp = @file_get_contents('http://127.0.0.1:3001/api/posts');
if ($resp === false) {
  $err = error_get_last();
  echo "FAILED\n";
  if ($err) {
    echo $err['message'] . "\n";
  }
  exit(1);
}
echo "OK\n";
echo substr($resp, 0, 200) . "\n";
