package com.hiweny.wenxin;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;

/**
 * 构建期校验：用真实 javac 编译 com.hiweny.wenxin.InlineJs，把拼出来的注入串写到磁盘，
 * 交给 node --check 做语法校验（避免字符串拼接语法错误静默上线）。
 *
 * 用法：java com.hiweny.wenxin.Gen <inject.js 路径> <输出路径> [dark|light]
 */
public class Gen {
    public static void main(String[] args) throws Exception {
        String inject = new String(Files.readAllBytes(Paths.get(args[0])), StandardCharsets.UTF_8);
        String out = args[1];
        boolean dark = args.length > 2 && args[2].equals("dark");
        String js = com.hiweny.wenxin.InlineJs.fullBootstrap(dark, dark ? "#17181c" : "#ffffff", inject);
        Files.write(Paths.get(out), js.getBytes(StandardCharsets.UTF_8));
        System.out.println("wrote " + out + " chars=" + js.length());
    }
}
