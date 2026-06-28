<?php

declare(strict_types=1);

final class AwXorCodec
{
    private const PRIME = 1373;

    /** @var array<string, int|string> */
    private const FIELD_LENGTHS = [
        'checksum' => '*',
        'board_id' => '*',
        'time_ms' => 4,
        'nick' => '*',
        'score' => 4,
        'date' => 4,
        'version' => 4,
    ];

    /**
     * @param array{checksum:string,board_id:string,time_ms:int,nick:string,score:int,date:int,version:int} $fields
     */
    public static function encode(array $fields): string
    {
        $clear = $fields;
        $date = (int) $clear['date'];
        $key = self::cryptKey($date);

        $encrypted = [];
        foreach (self::FIELD_LENGTHS as $name => $len) {
            if ($name === 'date') {
                $encrypted[$name] = self::intToStr($date);
                continue;
            }
            $plain = self::fieldToStr($name, $clear[$name]);
            $encrypted[$name] = self::xorStr($plain, $key);
        }

        return self::packHex($encrypted);
    }

    /**
     * @return array{checksum:string,board_id:string,time_ms:int,nick:string,score:int,date:int,version:int}|null
     */
    public static function decode(string $hexPayload): ?array
    {
        $encrypted = self::unpackHex($hexPayload);
        if ($encrypted === null) {
            return null;
        }
        $date = self::strToInt($encrypted['date']);
        $key = self::cryptKey($date);

        $clear = [];
        foreach (self::FIELD_LENGTHS as $name => $len) {
            if ($name === 'date') {
                $clear[$name] = $date;
                continue;
            }
            $plain = self::xorStr($encrypted[$name], $key);
            $clear[$name] = self::fieldFromStr($name, $plain);
        }
        return $clear;
    }

  /**
   * @param array<string, string> $encrypted
   */
    private static function packHex(array $encrypted): string
    {
        $out = '';
        foreach (self::FIELD_LENGTHS as $name => $len) {
            $bin = $encrypted[$name];
            if ($len === '*') {
                $out .= sprintf('%02X', strlen($bin));
            }
            $out .= self::strToHex($bin);
        }
        return $out;
    }

    /**
     * @return array<string, string>|null
     */
    private static function unpackHex(string $hex): ?array
    {
        $fields = [];
        foreach (self::FIELD_LENGTHS as $name => $len) {
            if ($len === '*') {
                if (strlen($hex) < 2) {
                    return null;
                }
                $byteLen = hexdec(substr($hex, 0, 2));
                $hex = substr($hex, 2);
                $charLen = $byteLen * 2;
            } else {
                $charLen = $len * 2;
            }
            if (strlen($hex) < $charLen) {
                return null;
            }
            $fields[$name] = self::hexToStr(substr($hex, 0, $charLen));
            $hex = substr($hex, $charLen);
        }
        return $fields;
    }

    private static function fieldToStr(string $name, int|string $value): string
    {
        if (in_array($name, ['time_ms', 'score', 'version'], true)) {
            return self::intToStr((int) $value);
        }
        return (string) $value;
    }

    private static function fieldFromStr(string $name, string $bytes): int|string
    {
        if (in_array($name, ['time_ms', 'score', 'version'], true)) {
            return self::strToInt($bytes);
        }
        return $bytes;
    }

    private static function cryptKey(int $date): string
    {
        $key = '';
        for ($i = 3; $i >= 0; $i--) {
            $val = ($date >> (8 * $i)) & 0xff;
            if ($val === 0) {
                $val = 1;
            }
            $key .= chr(($val * self::PRIME) % 256);
        }
        return $key;
    }

    private static function xorStr(string $input, string $key): string
    {
        if ($key === '') {
            return $input;
        }
        $out = '';
        $klen = strlen($key);
        for ($i = 0, $len = strlen($input); $i < $len; $i++) {
            $out .= $input[$i] ^ $key[$i % $klen];
        }
        return $out;
    }

    private static function strToHex(string $str): string
    {
        $hex = '';
        for ($i = 0, $len = strlen($str); $i < $len; $i++) {
            $hex .= sprintf('%02X', ord($str[$i]));
        }
        return $hex;
    }

    private static function hexToStr(string $hex): string
    {
        $out = '';
        for ($i = 0, $len = strlen($hex); $i < $len; $i += 2) {
            $out .= chr((int) hexdec(substr($hex, $i, 2)));
        }
        return $out;
    }

    private static function strToInt(string $str): int
    {
        $int = 0;
        $len = strlen($str);
        for ($i = 0; $i < $len; $i++) {
            $int += ord($str[$i]) * (256 ** ($len - $i - 1));
        }
        return $int;
    }

    private static function intToStr(int $int): string
    {
        if ($int <= 0) {
            return "\0\0\0\0";
        }
        $bytes = '';
        while ($int > 0) {
            $bytes = chr($int & 0xff) . $bytes;
            $int >>= 8;
        }
        return str_pad($bytes, 4, "\0", STR_PAD_LEFT);
    }
}
